# Login Scene — Reference-Led Earth Horizon

## Goal

Rebuild the login background around the uploaded reference: a fixed, dense navy starfield; a low curved night-Earth horizon; and the existing glass login panel floating clearly above it.

## Implementation

- Use the uploaded image as the visual source for the space and Earth treatment rather than inventing a different globe.
- Separate the scene into independent layers so the starfield and interface remain completely stationary.
- Keep the Earth boundary fixed at the bottom while animating only its visible surface from left to right at a slow, constant 75-second cycle, creating the clockwise-rotation effect without moving, scaling, or orbiting the scene.
- Preserve the reference’s thin cyan atmospheric rim, warm city lights, dark oceans, cloud detail, and large upper field of empty space.
- Remove the current generic full-globe Three.js scene from this page.
- Keep the existing premium glass form, but tune its placement and opacity so it remains above and visually separate from the horizon.

## Responsive Composition

- Desktop and laptop: Earth occupies roughly the bottom 20–30%; the form remains in the open space above it.
- Tablet and mobile: reduce the Earth’s visible height while keeping the horizon at the bottom and the form unobstructed.
- Use bounded responsive sizing and cropping for all listed viewport families; prevent stretching and horizontal overflow.

## Validation

- Compare screenshots at desktop, tablet, and mobile sizes against the reference.
- Capture two timed frames to confirm only the Earth surface changes while stars, horizon position, and form remain fixed.
- Verify sign-in/sign-up controls still work and the page has no runtime errors.

## Technical Note

A single still image contains no unseen 360° geography. The animation will therefore be a subtle, seamless surface-motion treatment within the fixed photographed Earth silhouette—not a newly generated globe or a rotation of the whole image. This prioritizes an exact visual match to the supplied frame while preserving the requested locked composition.
