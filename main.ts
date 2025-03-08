(async () => {
  const connectButton = <HTMLButtonElement>document.getElementById("connect");
  const send32MBDataButton = <HTMLButtonElement>document.getElementById("send-32mb-data");
  const send1MBDataButton = <HTMLButtonElement>document.getElementById("send-1mb-data");
  const send256KBDataButton = <HTMLButtonElement>document.getElementById("send-256kb-data");

  const ws = new WebSocket("ws://localhost:8080");

  const waitForConnected = Promise.withResolvers<void>();

  let channel: RTCDataChannel;
  const pc = new RTCPeerConnection();
  pc.addEventListener("datachannel", (event) => {
    channel = event.channel;
    channel.addEventListener("message", (event) => {
      console.log(`Received ${event.data.byteLength} bytes`);
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
})();
