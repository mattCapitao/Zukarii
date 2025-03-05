console.log("utilities.js loaded");


function camelToTitleCase(str) {
    return str
        .replace(/([A-Z])/g, ' $1') // Add space before each uppercase letter
        .replace(/^./, str => str.toUpperCase()) // Capitalize the first letter
        .trim(); // Remove any leading/trailing spaces
}




window.util = {
    camelToTitleCase,
}
