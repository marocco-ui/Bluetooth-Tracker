# The math

All distances in meters. 1 ft = 0.3048 m.

## 1. Signal strength to distance

Radio power falls off with distance. The log-distance path-loss model:

    RSSI = A − 10 · n · log₁₀(d)

    A = RSSI measured at 1 m
    n = path-loss exponent (2 in free space, 2 to 3 indoors)

Solve for d:

    10 · n · log₁₀(d) = A − RSSI

                 A − RSSI
    log₁₀(d) = ──────────
                  10 · n

                (A − RSSI) / (10 · n)
    d  =  10

Example with the starting values A = −59 dBm, n = 2.2, and a reading of −70 dBm:

    (A − RSSI) / (10 · n) = (−59 − (−70)) / (10 × 2.2)
                          = 11 / 22
                          = 0.5

    d = 10 to the 0.5
      = 3.16 m

A and n are placeholders. Phase 2 measures them in your room.

## 2. Why one receiver gives a ring

A distance d from the bugger at (x_b, y_b) fits every point on a circle:

    (x − x_b)² + (y − y_b)² = d²

The particle filter (phase 4) cuts the circle down using the room model, the likely spots in `room/room.json`, and the fact that you move at walking speed.

## 3. Why the receiver sits mid-desk

Distances from the bugger at (9.2, 1.9) ft to the common spots:

    d = √((x − 9.2)² + (y − 1.9)²)

| Spot | Distance |
|---|---|
| Desk chair | 0.8 ft |
| Middle of room | 4.3 ft |
| Your bed | 5.8 ft |
| Roommate's bed | 7.1 ft |
| Hall door | 8.3 ft |
| Mirror door | 11.1 ft |

No two spots share a distance. From the bike corner, your bed, the roommate's bed, and the hall door all fall between 7.4 and 8.1 ft, so one ring couldn't tell them apart.

## 4. Calibration, run 1 (2026-11-03)

Phone at chest height, tape measured from the bugger, iPhone hotspot as the network.

| Mark | d (m) | log₁₀(d) | RSSI (dBm) | Fit (dBm) | Error |
|---|---|---|---|---|---|
| 2 ft | 0.61 | −0.215 | −42 | −40.6 | −1.4 |
| 4 ft | 1.22 | 0.086 | −47 | −50.3 | +3.3 |
| 6 ft | 1.83 | 0.262 | −57 | −56.0 | −1.0 |
| 7.5 ft | 2.29 | 0.359 | −60 | −59.1 | −0.9 |

Least-squares line through (log₁₀(d), RSSI):

    slope = −32.2  →  n = 32.2 / 10 = 3.2
    A     = −47.5 dBm

    RMS error = 2.7 dB

n = 3.2 is normal for a furnished room with a body near the phone. Four points from one run, so treat these as provisional.
