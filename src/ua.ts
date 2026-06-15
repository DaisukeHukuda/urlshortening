export interface UaInfo {
  device: string;
  os: string;
  browser: string;
}

export function parseUserAgent(ua: string | null): UaInfo {
  if (!ua) return { device: "unknown", os: "unknown", browser: "unknown" };

  // device (order matters: tablet before mobile)
  let device = "desktop";
  if (/iPad/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) {
    device = "tablet";
  } else if (/Mobi|iPhone|iPod|Android.*Mobile/i.test(ua)) {
    device = "mobile";
  }

  // os
  let os = "other";
  if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/Windows/i.test(ua)) os = "Windows";
  else if (/Mac OS X|Macintosh/i.test(ua)) os = "macOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  // browser (order matters: Edge/Opera before Chrome, Chrome before Safari)
  let browser = "other";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/i.test(ua)) browser = "Opera";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Chrome\//i.test(ua)) browser = "Chrome";
  else if (/Safari\//i.test(ua) && /Version\//i.test(ua)) browser = "Safari";

  return { device, os, browser };
}
