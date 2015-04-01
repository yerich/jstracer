$(document).ready(function() {
    $("#render_button").click(function() {
        $.getJSON("scenes/"+$("#scene").val(), function(d) {
            window.d = drawImage(d);
        });
    });
});