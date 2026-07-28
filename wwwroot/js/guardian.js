document.addEventListener("DOMContentLoaded", function () {

    const terminateButtons =
        document.querySelectorAll(".btn-terminate-session");

    terminateButtons.forEach(button => {

        button.addEventListener("click", function () {

            const confirmed =
                confirm(
                    "Terminate this session?"
                );

            if (!confirmed) {
                return;
            }

            console.log(
                "Session termination requested"
            );

            // TODO:
            // AJAX POST
            // /Guardian/TerminateSession

        });

    });


    const removeDeviceButtons =
        document.querySelectorAll(".btn-remove-device");


    removeDeviceButtons.forEach(button => {

        button.addEventListener("click", function () {

            const confirmed =
                confirm(
                    "Remove this trusted device?"
                );


            if (!confirmed) {
                return;
            }


            console.log(
                "Device removal requested"
            );

            // TODO:
            // AJAX POST
            // /Guardian/RemoveDevice

        });

    });


    const generateCodesButton =
        document.querySelector(
            ".btn-generate-codes"
        );


    if(generateCodesButton)
    {

        generateCodesButton.addEventListener(
            "click",
            function(){

                const confirmed =
                    confirm(
                        "Generate new recovery codes?"
                    );


                if(!confirmed)
                {
                    return;
                }


                console.log(
                    "Generate recovery codes"
                );

                // TODO:
                // AJAX POST
                // /Guardian/GenerateRecoveryCodes

            }
        );

    }

});
