// Serves smaller, auto-optimised copies of images (faster on phones, lighter to scroll).
// Cloudinary uploads and the Unsplash demo photos are resized; any other URL is returned unchanged.
export function cld(url, width) {
  if (!url) return url;
  if (url.includes('res.cloudinary.com') && url.includes('/upload/')) {
    return url.replace('/upload/', `/upload/f_auto,q_auto,w_${width}/`);
  }
  if (url.includes('images.unsplash.com')) {
    return url.replace(/([?&])w=\d+/, `$1w=${width}`).replace(/([?&])q=\d+/, '$1q=75');
  }
  return url;
}

// All photos of a property, cover first. Falls back to the single old image field.
export function propertyImages(property, fallback) {
  const list = (property.images || []).map((image) => image.url).filter(Boolean);
  if (list.length) return list;
  const single = property.image_url || property.image || fallback;
  return single ? [single] : [];
}
