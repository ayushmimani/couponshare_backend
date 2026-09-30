// Given just a brand name (e.g. "Swiggy"), returns a real logo URL when possible.
//
// Clearbit's public autocomplete endpoint is designed exactly for this: give it a
// company name, it returns matching companies with their domain + logo. It needs
// no API key. If it finds nothing (unknown brand, endpoint unreachable, etc.) we
// fall back to a generated initials-avatar so the UI never breaks or shows a blank image.
async function fetchBrandLogo(brandName) {
  const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(brandName)}&background=6d28d9&color=fff&bold=true&size=128`;

  try {
    const res = await fetch(
      `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(brandName)}`
    );
    if (!res.ok) return fallback;

    const results = await res.json();
    if (Array.isArray(results) && results.length > 0 && results[0].logo) {
      return results[0].logo;
    }
    return fallback;
  } catch (err) {
    // Network error, Clearbit down, etc. - never let this break coupon creation.
    return fallback;
  }
}

module.exports = { fetchBrandLogo };
