export interface TextLayerGeometry {
  node: HTMLDivElement;
  values: Record<string, string>;
}

/** Align selectable text with the canvas without invalidating unchanged captures. */
export function updateTextLayerGeometry(
  node: HTMLDivElement,
  image: Pick<HTMLImageElement, 'naturalWidth' | 'naturalHeight'>,
  transform: { x: number; y: number; scale: number },
  previous: TextLayerGeometry | null,
): TextLayerGeometry {
  const values = {
    width: `${image.naturalWidth}px`,
    height: `${image.naturalHeight}px`,
    transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
  };
  for (const [property, value] of Object.entries(values)) {
    if (previous?.node !== node || previous.values[property] !== value)
      node.style.setProperty(property, value);
  }
  // Browsers round serialized CSS transforms. Comparing desired values avoids
  // rewriting equal geometry just because a read-back string has less precision.
  return { node, values };
}
