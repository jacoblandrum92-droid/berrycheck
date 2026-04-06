// =============================================
// Berry Counting Test Tray
// Each column has a different cone opening size
// =============================================
// HOW TO USE:
//   1. Open in OpenSCAD (openscad.org - free)
//   2. Hit F6 to render (~30 seconds)
//   3. File -> Export -> Export as STL
//   4. Slice: brim ON (8mm), 0.2mm layers, 20% infill
// =============================================

// --- Edit these if needed ---
hole_diameters = [8, 10, 12, 14, 16]; // mm opening at surface, one column each
rows            = 4;    // holes per column
pitch           = 24;   // center-to-center spacing mm
wall_t          = 3;    // wall thickness mm
wall_h          = 14;   // wall height above base
base_t          = 10;   // base thickness - cone is cut into this
cone_angle      = 118;  // degrees - standard twist drill bit angle
label_space     = 12;   // strip at back for embossed size labels
fn              = 64;   // smoothness

// --- Derived ---
cols     = len(hole_diameters);
inner_w  = cols * pitch;
inner_d  = rows * pitch + label_space;
outer_w  = inner_w + wall_t * 2;
outer_d  = inner_d + wall_t * 2;
total_h  = base_t + wall_h;
half_ang = cone_angle / 2;

difference() {

    // Solid block
    cube([outer_w, outer_d, total_h]);

    // Hollow interior above base (creates walls)
    translate([wall_t, wall_t, base_t])
        cube([inner_w + 0.01, inner_d + 0.01, wall_h + 0.1]);

    // Cone holes - opening faces UP at z=base_t, tip points DOWN into base
    for (c = [0 : cols - 1]) {
        d      = hole_diameters[c];
        r      = d / 2;
        cone_h = r / tan(half_ang); // how deep the cone is for this angle

        for (row = [0 : rows - 1]) {
            cx = wall_t + pitch / 2 + c * pitch;
            cy = wall_t + pitch / 2 + row * pitch;

            // r2=r at top (z=base_t), r1=0 at bottom (tip pointing down)
            translate([cx, cy, base_t - cone_h])
                cylinder(h = cone_h + 0.1, r1 = 0, r2 = r, $fn = fn);
        }
    }

    // Embossed size labels in the label strip
    for (c = [0 : cols - 1]) {
        d  = hole_diameters[c];
        cx = wall_t + pitch / 2 + c * pitch;
        cy = wall_t + rows * pitch + label_space / 2;

        translate([cx, cy, base_t - 0.6])
            linear_extrude(0.8)
                text(
                    str(d),
                    size   = 5,
                    halign = "center",
                    valign = "center",
                    font   = "Liberation Sans:style=Bold"
                );
    }

}

// Outer dimensions: ~126 x 114 x 24mm
// Fits Bambu A1 Mini easily
// 20 holes: 4 rows x 5 columns
// Cone openings: 8 / 10 / 12 / 14 / 16mm
