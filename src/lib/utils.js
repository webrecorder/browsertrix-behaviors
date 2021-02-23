export function sleep(timeout) {
  return new Promise((resolve) => setTimeout(resolve, timeout));
}

export function runOnload(func) {
  if (document.readyState === "complete") {
    func();
  } else {
    window.addEventListener("load", func);
  }
}