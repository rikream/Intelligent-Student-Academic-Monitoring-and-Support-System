let modelLoadPromise;

export async function loadFaceModels() {
  const faceapi = await import("@vladmandic/face-api");
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
    faceapi.nets.faceLandmark68TinyNet.loadFromUri("/models"),
    faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
  ]);
  return faceapi;
}

export async function getFaceDescriptor(video) {
  if (!modelLoadPromise) {
    modelLoadPromise = loadFaceModels().catch((error) => {
      modelLoadPromise = undefined;
      throw error;
    });
  }
  const faceapi = await modelLoadPromise;
  const detections = await faceapi
    .detectAllFaces(
      video,
      new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }),
    )
    .withFaceLandmarks(true)
    .withFaceDescriptors();
  if (detections.length === 0) {
    throw new Error("No face was detected. Adjust the camera or use manual attendance.");
  }
  if (detections.length > 1) {
    throw new Error("More than one face was detected. Use a clear single-person frame.");
  }
  return Array.from(detections[0].descriptor);
}
