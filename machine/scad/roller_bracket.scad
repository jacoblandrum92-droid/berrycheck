// =============================================
// Blueberry Grader - Roller End Bracket
// Holds two parallel roller shafts forming a V-groove
// Print one pair per lane-end (need 4 total per module)
// =============================================
// PRINT SETTINGS:
//   Material: PLA (frame) or PETG (better)
//   Layer height: 0.2mm
//   Infill: 40% - this is structural
//   Brim: ON 8mm
//   Supports: NO
// =============================================

// --- Parameters ---
roller_d        = 10;    // roller shaft outer diameter mm (with silicone tubing)
shaft_d         = 5;     // inner shaft diameter mm (PETG rod or wooden dowel)
v_angle         = 90;    // V-groove included angle degrees
pitch           = 22;    // berry center-to-center spacing mm
berry_d         = 17;    // max berry diameter mm
wall            = 4;     // wall thickness mm
bracket_h       = 40;    // bracket height mm
bracket_w       = 30;    // bracket width mm
bearing_depth   = 8;     // how deep the shaft sits in the bracket mm
m3_d            = 3.4;   // M3 bolt hole diameter
m3_head         = 6.5;   // M3 bolt head diameter
insert_d        = 4.2;   // heat set insert outer diameter
fn              = 48;

// --- Derived ---
half_angle  = v_angle / 2;  // 45 degrees each side
// Distance from V centerline to each roller center
// berry sits at center, rollers contact it at half_angle from vertical
roller_offset = (berry_d / 2 + roller_d / 2) * sin(half_angle);
// Height of roller centers above V bottom
roller_height = (berry_d / 2 + roller_d / 2) * cos(half_angle);

// =============================================
// BRACKET BODY
// =============================================
difference() {

    // Main bracket block
    union() {
        cube([bracket_w, wall, bracket_h]);

        // Roller cradle boss left
        translate([bracket_w/2 - roller_offset, wall, roller_height])
            rotate([90, 0, 0])
                cylinder(h = wall + bearing_depth, d = roller_d + wall*2, $fn=fn);

        // Roller cradle boss right
        translate([bracket_w/2 + roller_offset, wall, roller_height])
            rotate([90, 0, 0])
                cylinder(h = wall + bearing_depth, d = roller_d + wall*2, $fn=fn);
    }

    // Shaft hole left - berry rolls on left roller
    translate([bracket_w/2 - roller_offset, wall + bearing_depth + 0.1, roller_height])
        rotate([90, 0, 0])
            cylinder(h = wall + bearing_depth + 0.2, d = shaft_d, $fn=fn);

    // Shaft hole right
    translate([bracket_w/2 + roller_offset, wall + bearing_depth + 0.1, roller_height])
        rotate([90, 0, 0])
            cylinder(h = wall + bearing_depth + 0.2, d = shaft_d, $fn=fn);

    // V-groove cutout between roller bosses
    // Visualizes the V and removes material between bosses
    translate([bracket_w/2, -0.1, roller_height - 20])
        rotate([0, 0, 45])
            cube([20, 20, 25]);

    // M3 mounting holes bottom (for base plate attachment)
    translate([6, wall/2, 6])
        rotate([90, 0, 0])
            cylinder(h = wall + 1, d = m3_d, $fn=24);
    translate([bracket_w - 6, wall/2, 6])
        rotate([90, 0, 0])
            cylinder(h = wall + 1, d = m3_d, $fn=24);

    // Heat set insert holes top (for cross member attachment)
    translate([6, wall/2, bracket_h - 8])
        rotate([90, 0, 0])
            cylinder(h = 6, d = insert_d, $fn=24);
    translate([bracket_w - 6, wall/2, bracket_h - 8])
        rotate([90, 0, 0])
            cylinder(h = 6, d = insert_d, $fn=24);

}

// =============================================
// REFERENCE COMMENTS
// Roller center left:  x = bracket_w/2 - roller_offset
// Roller center right: x = bracket_w/2 + roller_offset  
// Roller height:       z = roller_height
// Berry sits at:       x = bracket_w/2, z = roller_height + roller_d/2 + berry_d/2
// =============================================
