export function cameraError(error: { name?: string; message?: string }) {
  if (error.name === "NotAllowedError")
    return "Camera permission was denied. Allow camera access in your browser, then try again. Guided practice is still available.";
  if (error.name === "NotFoundError")
    return "No camera was found. Connect a camera or continue with guided practice.";
  if (error.name === "NotReadableError")
    return "The camera is in use or unavailable. Close other camera apps and try again.";
  if (error.name === "OverconstrainedError")
    return "The selected camera is unavailable. Choose System default in Settings and try again.";
  return (
    error.message ||
    "The camera could not start. Try again or continue with guided practice."
  );
}
