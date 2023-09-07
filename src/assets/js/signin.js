

document.addEventListener("DOMContentLoaded", function () {
    const upLink = document.querySelector("a.up");

    upLink.addEventListener("click", function (event) {
        event.preventDefault();

        const id1Element = document.getElementById("id1");
        id1Element.textContent = "Sign-up";

        const id2Element = document.getElementById("id2");
        id2Element.textContent = "Sign-up";

        const id3Element = document.getElementById("id3");
        id3Element.textContent = "Sign-up with Google";

        const id4Element = document.getElementById("id4");
        id4Element.textContent = "Register for a NEW Experience";

        const id5Element = document.getElementById("id5");
        id5Element.textContent = "Join us for exciting offers.";

    });
});
