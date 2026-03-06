const fs = require("fs");
const path = require("path");

describe("liquid autonomy blueprint files", () => {
    test("contains terraform and max-for-live receiver assets", () => {
        const root = path.join(__dirname, "..");
        const terraformMain = path.join(root, "infrastructure", "terraform", "main.tf");
        const terraformVariables = path.join(root, "infrastructure", "terraform", "variables.tf");
        const maxReceiver = path.join(root, "integrations", "max-for-live", "heady_sysex_receiver.js");

        expect(fs.existsSync(terraformMain)).toBe(true);
        expect(fs.existsSync(terraformVariables)).toBe(true);
        expect(fs.existsSync(maxReceiver)).toBe(true);

        expect(fs.readFileSync(terraformMain, "utf8")).toContain("heady-admin-triggers");
        expect(fs.readFileSync(maxReceiver, "utf8")).toContain("HEADY_ID = 125");
    });
});
