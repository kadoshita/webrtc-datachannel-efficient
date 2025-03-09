(async () => {
  const connectButton = <HTMLButtonElement>document.getElementById("connect");
  const send32MBDataButton = <HTMLButtonElement>document.getElementById("send-32mb-data");
  const send1MBDataButton = <HTMLButtonElement>document.getElementById("send-1mb-data");
  const send256KBDataButton = <HTMLButtonElement>document.getElementById("send-256kb-data");
  const selectLargeDataSize = <HTMLSelectElement>document.getElementById("large-data-size");
  const sendLargeDataButton = <HTMLButtonElement>document.getElementById("send-large-data");

  const ws = new WebSocket("ws://localhost:8080");

  const waitForConnected = Promise.withResolvers<void>();

  let channel: RTCDataChannel;
  let totalBytesReceived = 0;
  const pc = new RTCPeerConnection();
  pc.addEventListener("datachannel", (event) => {
    channel = event.channel;
    channel.addEventListener("error", ({ error }) => {
      console.error(error);
    });
    channel.addEventListener("closing", () => {
      console.log("Data channel is closing");
    });
    channel.addEventListener("close", () => {
      console.log("Data channel is closed");
    });
    channel.addEventListener("message", (event) => {
      totalBytesReceived += event.data.byteLength;
      console.log(`Received ${event.data.byteLength} bytes (total: ${totalBytesReceived})`);
    });
  });
  pc.addEventListener("icecandidate", (event) => {
    if (event.candidate) {
      ws.send(
        JSON.stringify({
          type: "ice-candidate",
          data: event.candidate,
        })
      );
    }
  });
  pc.addEventListener("connectionstatechange", () => {
    if (pc.connectionState === "connected") {
      waitForConnected.resolve();
    } else if (pc.connectionState === "failed") {
      waitForConnected.reject(new Error("Connection failed"));
    }
  });

  ws.addEventListener("message", async (event) => {
    const message = JSON.parse(event.data);
    if (message.type === "offer") {
      await pc.setRemoteDescription(message.data);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      ws.send(
        JSON.stringify({
          type: "answer",
          data: answer,
        })
      );
    } else if (message.type === "answer") {
      await pc.setRemoteDescription(message.data);
    } else if (message.type === "ice-candidate") {
      await pc.addIceCandidate(message.data);
    }
  });

  connectButton.addEventListener("click", async () => {
    channel = pc.createDataChannel(`channel`);
    channel.addEventListener("error", ({ error }) => {
      console.error(error);
    });
    channel.addEventListener("closing", () => {
      console.log("Data channel is closing");
    });
    channel.addEventListener("close", () => {
      console.log("Data channel is closed");
    });
    channel.addEventListener("message", (event) => {
      console.log(`Received ${event.data.byteLength} bytes`);
    });
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    ws.send(
      JSON.stringify({
        type: "offer",
        data: offer,
      })
    );
  });

  await waitForConnected.promise;
  console.log("WebRTC connected");

  send32MBDataButton.addEventListener("click", async () => {
    const data = new Uint8Array(32 * 1024 * 1024);
    channel.send(data);
    console.log(`Sent ${data.byteLength} bytes`);
  });

  send1MBDataButton.addEventListener("click", async () => {
    const data = new Uint8Array(1 * 1024 * 1024);
    channel.send(data);
    console.log(`Sent ${data.byteLength} bytes`);
  });

  send256KBDataButton.addEventListener("click", async () => {
    const data = new Uint8Array(256 * 1024);
    channel.send(data);
    console.log(`Sent ${data.byteLength} bytes`);
  });

  sendLargeDataButton.addEventListener("click", async () => {
    // ref: https://www.rfc-editor.org/rfc/rfc8831.html#name-transferring-user-data-on-a
    const chunkSize = 16 * 1024;
    channel.bufferedAmountLowThreshold = 1024 * 1024;
    let waitForBufferedAmountLow = Promise.withResolvers<void>();
    channel.addEventListener("bufferedamountlow", () => {
      waitForBufferedAmountLow.resolve();
    });
    const dataSize = parseInt(selectLargeDataSize.value);
    const data = new Uint8Array(dataSize);
    for (let i = 0; i < data.byteLength; i += chunkSize) {
      if (channel.bufferedAmount > channel.bufferedAmountLowThreshold) {
        console.log(`Waiting for bufferedAmount to be low (current: ${channel.bufferedAmount})`);
        await waitForBufferedAmountLow.promise;
        console.log(`bufferedAmount is low (current: ${channel.bufferedAmount})`);
        waitForBufferedAmountLow = Promise.withResolvers<void>();
      }
      channel.send(data.slice(i, i + chunkSize));
      console.log(`Sent ${chunkSize} bytes (total: ${i + chunkSize}/${data.byteLength})`);
    }
    console.log(`Sent ${data.byteLength} bytes`);
  });
})();
