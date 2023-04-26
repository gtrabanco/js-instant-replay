/* eslint-disable no-unused-vars */
// Load cameras: select#cameras
// Make a replay button#createReplay
// Video player: video#playVideo

const mediaRecorderStatus = {
  inactive: "inactive",
  paused: "paused",
  recording: "recording",
};

let selectedCamera = localStorage.getItem("selectedCamera") ?? null;
let devices = null;
const chunks = {};
let viewChunk = true;

async function getCaptureDeviceStream(deviceId) {
  if (!navigator.mediaDevices?.getUserMedia) {
    console.error("getUserMedia() not supported.");
    return;
  }

  const constraints = {
    video: {
      deviceId,
    },
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    return stream;
  } catch (error) {
    console.error(error);
  }

  return null;
}

async function playOnVideoElement(element, deviceId) {
  const stream = await getCaptureDeviceStream(deviceId);
  element.srcObject = stream;
  element.play();
}

async function recordVideo(deviceId, options = {
  interval: 500,
  videoCacheSeconds: 20,
}) {
  const stream = await getCaptureDeviceStream(deviceId);
  const mediaRecorder = new MediaRecorder(stream);

  mediaRecorder.addEventListener("dataavailable", (event) => {
    chunks[deviceId] ??= [];
    chunks[deviceId].push(event.data);
    const conserveChunks = options.videoCacheSeconds * 1000 / options.interval;
    if (chunks[deviceId].length > conserveChunks) {
      chunks[deviceId] = chunks[deviceId].slice(-conserveChunks);
    }
    if (viewChunk) console.log({ event }, JSON.stringify(event.data, null, 2));
    viewChunk = false;
  });

  mediaRecorder.addEventListener("stop", () => {
    delete chunks[deviceId];
  });

  if (mediaRecorder.state !== mediaRecorderStatus.recording) {
    mediaRecorder.start();
  }

  const interval = setInterval(() => {
    if(mediaRecorder.state === mediaRecorderStatus.recording) return mediaRecorder.requestData();

    mediaRecorder.start();
  }, 500);

  return {
    mediaRecorder,
    stop: () => {
      if (mediaRecorder.state === mediaRecorderStatus.recording) mediaRecorder.stop(); 
      clearInterval(interval);
    },
    createClip: (timeInSecons = 5) => {
      if(mediaRecorder.state === mediaRecorderStatus.recording) mediaRecorder.requestData();
      const currentTimestamp = Date.now();
      const deviceChunks = chunks[deviceId];
      const numberOfChunks = timeInSecons * 1000 / options.interval;
      const clipChunks = deviceChunks.slice(-numberOfChunks);
      console.log({ clipChunks });
      const blob = new Blob(clipChunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);

      return url;
    }
  };
}

window.addEventListener("load", () => {
  const cameras = document.querySelector("#cameras");
  const recordButton = document.querySelector("#record");
  const playVideo = document.querySelector("#playVideo");
  const createClipButton = document.querySelector("#createClip");
  const stopButton = document.querySelector("#stop");

  if (!navigator.mediaDevices?.enumerateDevices) {
    console.error("enumerateDevices() not supported.");
    return;
  }

  if (selectedCamera) {
    playOnVideoElement(playVideo, selectedCamera);
  }

  recordButton.addEventListener("click", () => {
    if (selectedCamera === null) return;

    (async () => {
      const { stop: stopFn, createClip, mediaRecorder } = await recordVideo(selectedCamera);
      console.log({ mediaRecorder });
      recordButton.disabled = true;
      stopButton.disabled = false;
      stopButton.addEventListener("click", () => {
        stopFn();
        recordButton.disabled = false;
        stopButton.disabled = true;
      });

      createClipButton.addEventListener("click", () => {
        const url = createClip();
        console.log( {url});
        const replay = document.querySelector("#replay");
        replay.src = url;
      });
    })();
  });

  // Add cameras
  cameras.addEventListener("focus", (event) => {
    (async () => {
      try {
        const permissions = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        // console.log(permissions);
      } catch (error) {
        return;
      }

      devices = await navigator.mediaDevices.enumerateDevices();
      const camerasDevices = devices.filter((device) => device.kind === "videoinput");
      cameras.childNodes.forEach((camera) => camera.remove());
      camerasDevices.forEach((camera) => {
        // console.log(camera);
        const option = document.createElement("option");
        option.value = camera.deviceId;
        option.text = camera.label;
        cameras.appendChild(option);
      });
    })();
  });

  cameras.addEventListener("change", (event) => {
    selectedCamera = event.target.value;
    playOnVideoElement(playVideo, selectedCamera);
    localStorage.setItem("selectedCamera", selectedCamera);
  });
});
