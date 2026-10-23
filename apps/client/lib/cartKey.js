// A dish can be ordered more than once with different toppings/extras
// (e.g. one Red Velvet Waffle with Ice Cream and another without). Each
// distinct combination needs to be its own cart line, otherwise changing
// the extras on one unit silently rewrites every unit of that dish in
// the cart. This builds a stable key from the dish id plus the exact
// topping/extra selection so Home and the Cart tab can tell those lines
// apart instead of merging them by dish id alone.
export function buildCartKey(dishId, toppingNames = [], extraNames = []) {
  const toppingsKey = [...toppingNames].sort().join(',')
  const extrasKey = [...extraNames].sort().join(',')
  return `${dishId}__${toppingsKey}__${extrasKey}`
}
