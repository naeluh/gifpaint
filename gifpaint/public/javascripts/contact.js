// JavaScript Document
$(document).ready(function() {

	$('.error').hide(); //Hide error messages 
	$('#MainResult').hide(); //we will hide this right now
	$('#form-wapper').hide(); //hiden main form
	$("button").click(function() { //User clicks on Submit button
	 
	 // Fetch data from input fields.
	 var js_name = $("#name").val();
	 var js_email = $("#email").val();
	 var js_phone = $("#phone").val();
	 var js_message = $("#message").val();
	 
	 // Do a simple validation
	 if(js_name==""){
	 	 $("#nameLb .error").show(); // If Field is empty, we'll just show error text inside <span> tag.
		 return false;}
	 if(js_email==""){
	 	 $("#emailLb .error").show();
		 return false;}
	 if(js_phone==""){
	 	 $("#phoneLb .error").show();
		 return false;}
	 if(js_message==""){
	 	$("#messageLb .error").show();
		return false;}
	
		//let's put all data together
	  var myData = 'postName='+ js_name + '&postEmail=' + js_email + '&postPhone=' + js_phone + '&postMessage=' + js_message;
	  
            jQuery.ajax({
                type: "POST",
                url: "ajaxprocess.php",
                dataType:"html",
                data:myData,
                success:function(response){
                    $("#MainResult").html('<fieldset class="response">'+response+'</fieldset>');
					$("#MainResult").slideDown("slow"); //show Result 
					$("#MainContent").hide(); //hide form div slowly
                },
                error:function (xhr, ajaxOptions, thrownError){
					$("#ErrResults").html(thrownError);
                }    
            });
		return false;
	});
	
	//If user wants to send another mail, send him back to form.
	$("#gobacknow").live("click", function() { 
				$("#MainResult").hide(); //show Result 
				$("#MainContent").slideDown("slow"); //hide form div slowly
				
				//clear all fields to empty state
				$("#name").val('');$("#email").val('');$("#phone").val('');$("#message").val('');
	});
	
	$("#OpenContact").live("click", function() { 
				$("#form-wapper").toggle("slow");

	});
});