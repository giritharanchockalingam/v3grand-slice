/**
 * Geo utilities — Haversine distance to nearest Indian airport.
 * Pure TypeScript, zero external dependencies.
 */

interface Airport {
  name: string;
  code: string;
  lat: number;
  lng: number;
}

const INDIAN_AIRPORTS: Airport[] = [
  { name: 'Indira Gandhi International', code: 'DEL', lat: 28.5562, lng: 77.1000 },
  { name: 'Chhatrapati Shivaji Maharaj International', code: 'BOM', lat: 19.0896, lng: 72.8656 },
  { name: 'Kempegowda International', code: 'BLR', lat: 13.1986, lng: 77.7066 },
  { name: 'Rajiv Gandhi International', code: 'HYD', lat: 17.2403, lng: 78.4294 },
  { name: 'Chennai International', code: 'MAA', lat: 12.9941, lng: 80.1709 },
  { name: 'Cochin International', code: 'COK', lat: 10.1520, lng: 76.4019 },
  { name: 'Goa International (Manohar)', code: 'GOX', lat: 15.3808, lng: 73.8314 },
  { name: 'Jaipur International', code: 'JAI', lat: 26.8242, lng: 75.8122 },
  { name: 'Netaji Subhas Chandra Bose International', code: 'CCU', lat: 22.6547, lng: 88.4467 },
  { name: 'Chaudhary Charan Singh International', code: 'LKO', lat: 26.7606, lng: 80.8893 },
  { name: 'Sardar Vallabhbhai Patel International', code: 'AMD', lat: 23.0772, lng: 72.6347 },
  { name: 'Pune Airport', code: 'PNQ', lat: 18.5822, lng: 73.9197 },
  { name: 'Trivandrum International', code: 'TRV', lat: 8.4821, lng: 76.9201 },
  { name: 'Sri Guru Ram Dass Jee International', code: 'ATQ', lat: 31.7096, lng: 74.7973 },
  { name: 'Maharana Pratap (Udaipur)', code: 'UDR', lat: 24.6177, lng: 73.8961 },
  { name: 'Devi Ahilya Bai Holkar (Indore)', code: 'IDR', lat: 22.7217, lng: 75.8011 },
  { name: 'Lokpriya Gopinath Bordoloi (Guwahati)', code: 'GAU', lat: 26.1061, lng: 91.5859 },
  { name: 'Biju Patnaik (Bhubaneswar)', code: 'BBI', lat: 20.2444, lng: 85.8178 },
  { name: 'Coimbatore International', code: 'CJB', lat: 11.0300, lng: 77.0434 },
  { name: 'Bagdogra Airport', code: 'IXB', lat: 26.6812, lng: 88.3286 },
  { name: 'Madurai Airport', code: 'IXM', lat: 9.8345, lng: 78.0934 },
  { name: 'Tiruchirapalli International', code: 'TRZ', lat: 10.7654, lng: 78.7097 },
  { name: 'Visakhapatnam Airport', code: 'VTZ', lat: 17.7212, lng: 83.2245 },
  { name: 'Mangalore International', code: 'IXE', lat: 12.9613, lng: 74.8900 },
  { name: 'Varanasi Airport', code: 'VNS', lat: 25.4524, lng: 82.8593 },
  { name: 'Chandigarh Airport', code: 'IXC', lat: 30.6735, lng: 76.7885 },
  { name: 'Raipur Airport', code: 'RPR', lat: 21.1804, lng: 81.7388 },
  { name: 'Ranchi Airport', code: 'IXR', lat: 23.3143, lng: 85.3217 },
  { name: 'Patna Airport', code: 'PAT', lat: 25.5913, lng: 85.0880 },
  { name: 'Dehradun Airport', code: 'DED', lat: 30.1897, lng: 78.1803 },
  { name: 'Srinagar Airport', code: 'SXR', lat: 33.9871, lng: 74.7742 },
  { name: 'Calicut International', code: 'CCJ', lat: 11.1368, lng: 75.9553 },
  { name: 'Mysore Airport', code: 'MYQ', lat: 12.2300, lng: 76.6556 },
];

/** Convert degrees to radians */
function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Haversine distance between two lat/lng points in km */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface NearestAirportResult {
  airportName: string;
  airportCode: string;
  distanceKm: number;
}

/**
 * Find the nearest major Indian airport to a given lat/lng.
 * Returns airport name, code, and distance in km.
 */
export function findNearestAirport(lat: number, lng: number): NearestAirportResult {
  let nearest: NearestAirportResult = {
    airportName: INDIAN_AIRPORTS[0].name,
    airportCode: INDIAN_AIRPORTS[0].code,
    distanceKm: Infinity,
  };

  for (const airport of INDIAN_AIRPORTS) {
    const dist = haversineKm(lat, lng, airport.lat, airport.lng);
    if (dist < nearest.distanceKm) {
      nearest = {
        airportName: airport.name,
        airportCode: airport.code,
        distanceKm: Math.round(dist * 10) / 10, // 1 decimal place
      };
    }
  }

  return nearest;
}
