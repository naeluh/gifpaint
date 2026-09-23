$(function(){

	$('#change-form')
	   .validate({
         submitHandler: function(form) {
           $(form).ajaxSubmit({
                success: function() {
                    $('#change-form').hide();
                    $('#page-wrap').append("<p class='thanks'>Thanks! Your request has been sent.</p></div>")
                }
           });
         }
        }); 
        

    
      $("input[name=typeOfChange]").click(function() {
        if ($("input[name='typeOfChange']:checked").val() == "Add New Content"){
            $("#curTextArea").slideUp();
        } else {
            $("#curTextArea").slideDown();
        }
    });
	
});
