export function shareURL() {
  return window.electricityDesktop
    ? `electricity-map://open${window.location.search}`
    : window.location.href;
}
