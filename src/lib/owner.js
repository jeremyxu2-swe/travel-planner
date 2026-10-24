// Trips shared with you (and everything in them) belong to someone else's account.
// In the app their ids carry the owner: "<owner uuid>~<id>", so they can never clash
// with your own ids. Sync strips the prefix again when talking to the database.

export const SEP = '~';

export const isShared = (id) => typeof id === 'string' && id.includes(SEP);
export const ownerOf = (id) => (isShared(id) ? id.slice(0, id.indexOf(SEP)) : null);
export const rawId = (id) => (isShared(id) ? id.slice(id.indexOf(SEP) + 1) : id);
export const sharedId = (owner, id) => `${owner}${SEP}${id}`;

// New items added to a shared trip get the trip owner's prefix too.
export function inTrip(item) {
  const owner = ownerOf(item.tripId);
  return owner && !isShared(item.id) ? { ...item, id: sharedId(owner, item.id) } : item;
}

// 'owner' | 'editor' | 'viewer'
export const tripRole = (trip) => (trip?.role ? trip.role : 'owner');
export const canEdit = (trip) => tripRole(trip) !== 'viewer';

// "Alice" or "alice@example.com" for a trip someone shared with you.
export const ownerLabel = (trip) => trip?.ownerName || trip?.ownerEmail || 'the owner';
