# Painted water monster and orb attacks

Reference: the original project images/water_monster.png, preserved unchanged under originals/. Nine newly generated transparent sheets supply 240 complete sprites: 16 idle directions plus 8 directions with 4 swimming and 4 firing phases, across level, above and below cameras. No overhead set. These are image-generated raster sprites, not vector rules. Hidden surfaces and motion are interpretations of the drawing. Whole-figure reflections normalize symmetric left-facing directions; no heads or body parts are pasted.

The game uses four cyan/teal pigment bands, preserving red eyes and black ink. Complete connected figures are packed with transparent gutters and a shared waterline. The original image remains available as a loading fallback.

The water monster guards its existing pond spawn, turns toward the player and cycles its swimming fins without leaving the pond. Within 85 world units and clear sight, it charges for 0.85 seconds and spits a straight cyan-white orb at 22 units/second; the next charge starts after 2.7 seconds. Shots use exactly the UFO glow texture function, color and additive blending. Cover intercepts them, and each orb is removed on collision or expiry. Aim is fixed at launch, so shots can be dodged. Terrain and solid cover block charging.

Two distinct orb impacts cause the existing death/respawn flow. A brief red edge flash signals a hit. No player health counter, meter or two-hit tutorial is added. Damage does not regenerate; respawn clears wounds and outstanding projectiles. Pause, dialogue, death, noclip and godmode are respected.

The water-monster-review.html carousel includes idle/swimming/firing, direction and camera controls, animation scrubber, all-directions gallery, and cel shading toggle. The firing preview glow is separate from the image, matching the runtime composition.
