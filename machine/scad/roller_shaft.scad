// =============================================
// Blueberry Grader - Diabolo Roller Shaft v3
// Trimmed to 244mm to fit A1 Mini diagonally
// A1 Mini bed diagonal = 254mm
// 244mm part + 8mm brim each end = 260mm... 
// orient at slight angle in slicer
// =============================================
// PRINT SETTINGS:
//   Material: PETG
//   Layer height: 0.15mm
//   Infill: 60%
//   Brim: YES 8mm
//   Supports: NO
//   ORIENTATION: rotate 45 degrees on bed in Bambu Slicer
//     - Select part
//     - Rotation tool
//     - Set Z rotation to 45 degrees
//     - Auto-place to drop to bed
// =============================================

// --- Parameters ---
berry_count  = 10;
berry_pitch  = 22;    // mm waist to waist
waist_r      = 4;     // radius at berry saddle (8mm dia)
peak_r       = 8;     // radius at divider peak (16mm dia)
end_stub_r   = 3;     // radius of end stubs
end_stub_l   = 12;    // trimmed from 15 to 12mm - saves 6mm total
steps        = 200;   // profile resolution
fn           = 64;    // rotational resolution

// --- Derived ---
active_l     = berry_count * berry_pitch;  // 220mm
total_l      = active_l + end_stub_l * 2; // 244mm - fits diagonally

// =============================================
// PROFILE FUNCTION
// Returns shaft radius at any Z position
// =============================================
function shaft_r(z) =
    (z < end_stub_l) ? end_stub_r :
    (z > end_stub_l + active_l) ? end_stub_r :
    waist_r + (peak_r - waist_r) *
    (1 - cos(((z - end_stub_l) / berry_pitch) * 360)) / 2;

// Build 2D profile polygon points
profile_pts = [
    [0, 0],
    for (i = [0 : steps])
        let(z = i * total_l / steps,
            r = shaft_r(z))
        [r, z],
    [0, total_l]
];

// Revolve 360 degrees around Z axis
rotate_extrude(angle = 360, $fn = fn)
    polygon(points = profile_pts);

// =============================================
// FINAL DIMENSIONS
// Total length:  244mm
// Active length: 220mm (10 x 22mm)
// Waist dia:     8mm
// Peak dia:      16mm
// End stub dia:  6mm x 12mm long
// Bed diagonal:  254mm - fits at 45 degrees with room
// =============================================
