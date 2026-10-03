export function getSpeechRecognitionConstructor(browserWindow = window) {
  return browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition ?? null;
}

export function hasCameraSupport(browserNavigator = navigator) {
  return typeof browserNavigator.mediaDevices?.getUserMedia === "function";
}
