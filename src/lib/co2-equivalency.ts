/** Translate CO₂ kg into a relatable equivalency (from Shift app's impact engine) */
export function co2Equivalency(kg: number): string {
  const grams = kg * 1000
  if (grams < 5000) {
    const bags = grams / 1000
    if (bags < 1.5) return 'Like keeping a bag of trash out of a landfill'
    return `Like keeping ${Math.round(bags)} bags of trash out of a landfill`
  }
  const trees = grams / 22000
  if (trees < 1.5) return 'Like planting a tree for a year'
  return `Like planting ${Math.round(trees)} trees for a year`
}
