const INTERAKT_API_URL = "https://api.interakt.ai/v1/public/message/";

export async function sendWhatsAppAlert(phoneNumber: string, message: string) {
  const apiKey = process.env.INTERAKT_API_KEY;
  if (!apiKey) {
    console.warn("INTERAKT_API_KEY not set — skipping WhatsApp notification");
    return;
  }

  // Interakt uses template-based messaging, but for simplicity we'll use
  // the "text" type for non-template messages, or a generic alert template.
  // The actual template name must be pre-approved in Interakt dashboard.
  const response = await fetch(INTERAKT_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      countryCode: "+91",
      phoneNumber: phoneNumber.replace(/^\+91/, ""),
      callbackData: "ipd-alert",
      type: "Text",
      data: { message },
    }),
  });

  if (!response.ok) {
    console.error("Interakt API error:", response.status, await response.text());
  }
}

export async function sendAlertToAll(message: string) {
  const numbers =
    process.env.WHATSAPP_ALERT_NUMBERS?.split(",")
      .map((n) => n.trim())
      .filter(Boolean) || [];
  if (numbers.length === 0) {
    console.warn("WHATSAPP_ALERT_NUMBERS not set — skipping notifications");
    return;
  }
  await Promise.allSettled(numbers.map((num) => sendWhatsAppAlert(num, message)));
}
