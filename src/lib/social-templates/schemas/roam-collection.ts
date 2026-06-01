import { z } from 'zod';
import { type Platform } from '../platform-overrides';

const collectionItemSchema = z.object({
  name: z.string().min(1).max(60),
  img: z.string().url(),
});

export function roamCollectionSchema(_platform: Platform) {
  return z.object({
    collection: z.string().max(40).default('MassTrails 10'),      // collection name (highlighted inline)
    title: z.string().max(100).default('The trails are calling.'),
    blurb: z.string().max(300).optional(),
    curators: z.string().max(60).optional(),                      // e.g. "Curated by MassDOT & DCR"
    count: z.string().max(20).default('10 roams'),                // lime pill label
    total: z.number().int().min(1).default(10),                   // drives "+N more" math
    items: z.array(collectionItemSchema).min(5),                  // first 5 shown as photo tiles
  });
}
