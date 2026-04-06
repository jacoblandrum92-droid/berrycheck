// =============================================
// Blueberry Grader - Shaft Coupler
// Joins two 125mm half-shafts into one 250mm shaft
// Print 2 per machine (one per full shaft)
// =============================================
// PRINT SETTINGS:
//   Material: PETG
//   Layer height: 0.2mm
//   Infill: 80% - this is the most stressed part
//   Brim: YES
// =============================================

shaft_d     = 6;    // must match shaft_end_d in roller_shaft.scad
coupler_d   = 12;   // outer diameter of coupler
coupler_l   = 30;   // total length - 15mm grip each side
wall        = 3;
fn          = 48;

difference() {
    cylinder(h = coupler_l, d = coupler_d, $fn = fn);

    // Hole through center
    translate([0, 0, -0.1])
        cylinder(h = coupler_l + 0.2, d = shaft_d + 0.3, $fn = fn);

    // Grub screw holes (M2.5) each side for set screws
    translate([0, coupler_d/2, coupler_l * 0.25])
        rotate([90, 0, 0])
            cylinder(h = coupler_d, d = 2.7, $fn = 24);
    translate([0, coupler_d/2, coupler_l * 0.75])
        rotate([90, 0, 0])
            cylinder(h = coupler_d, d = 2.7, $fn = 24);
}
