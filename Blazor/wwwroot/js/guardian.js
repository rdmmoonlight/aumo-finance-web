document.addEventListener("DOMContentLoaded", function () {

    // Terminate Session
    document.querySelectorAll(".btn-terminate-session")
        .forEach(button => {

            button.addEventListener("click", function () {

                const confirmed = confirm(
                    "Terminate this active session?"
                );

                if (!confirmed) {
                    return;
                }

                console.log(
                    "Terminate session request"
                );

                /*
                    TODO:
                    POST /Guardian/TerminateSession
                */

            });

        });


    // Remove Trusted Device
    document.querySelectorAll(".btn-remove-device")
        .forEach(button => {

            button.addEventListener("click", function () {

                const confirmed = confirm(
                    "Remove this trusted device?"
                );

                if (!confirmed) {
                    return;
                }

                console.log(
                    "Remove device request"
                );

                /*
                    TODO:
                    POST /Guardian/RemoveDevice
                */

            });

        });


    // Generate Recovery Codes
    const generateButton =
        document.querySelector(".btn-generate-codes");


    if (generateButton) {

        generateButton.addEventListener(
            "click",
            function () {

                const confirmed = confirm(
                    "Generate new recovery codes?"
                );

                if (!confirmed) {
                    return;
                }

                console.log(
                    "Generate recovery codes request"
                );

                /*
                    TODO:
                    POST /Guardian/GenerateRecoveryCodes
                */

            }
        );

    }


});
