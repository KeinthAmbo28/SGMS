const readline = require("readline");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log("\n=== PAYMENT METHOD TEST ===");
console.log("Precondition: User is on Payments Page\n");

console.log("Select Payment Method:");
console.log("1. Cash");
console.log("2. Card");
console.log("3. Online");

rl.question("\nEnter choice (1-3): ", (input) => {

    let method = "";
    let status = "FAIL";
    let notes = "";

    if (input === "1") {
        method = "Cash";
        status = "PASS";
        notes = "Valid selection";
    } 
    else if (input === "2") {
        method = "Card";
        status = "PASS";
        notes = "Valid selection";
    } 
    else if (input === "3") {
        method = "Online";
        status = "PASS";
        notes = "Valid selection";
    } 
    else {
        method = "None";
        notes = "Invalid input";
    }

    console.log("\n=== TEST RESULT ===");
    console.log("Selected Method:", method);
    console.log("Status:", status);
    console.log("Notes:", notes);

    rl.close();
});
