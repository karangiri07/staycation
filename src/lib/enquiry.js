// Tells the backend that a visitor tapped WhatsApp on a property, so the admin dashboard can count enquiries.
// It never waits for the answer, never delays the WhatsApp link, and a failure is simply ignored.
export function trackEnquiry(api, id) {
  if (!Number.isInteger(id)) return;
  try {
    fetch(`${api}/api/properties/${id}/enquiry`, { method: 'POST', keepalive: true }).catch(() => {});
  } catch { /* ignore */ }
}
