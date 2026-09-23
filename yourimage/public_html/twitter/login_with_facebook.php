<?php
/*
 * login_with_facebook.php
 *
 * @(#) $Id: login_with_facebook.php,v 1.3 2013/07/31 11:48:04 mlemos Exp $
 *
 */

	/*
	 *  Get the http.php file from http://www.phpclasses.org/httpclient
	 */

  	error_reporting(-1);
  	ini_set('display_errors', 'On');
	require_once("fb/src/facebook.php");
	require('http.php');
	require('oauth_client.php');

	$client = new oauth_client_class;
	$client->debug = false;
	$client->debug_http = true;
	$client->server = 'Facebook';
	$client->redirect_uri = 'http://'.$_SERVER['HTTP_HOST'].
		dirname(strtok($_SERVER['REQUEST_URI'],'?')).'/login_with_facebook.php';

	$client->client_id = '1000502090089422'; $application_line = __LINE__;
	$client->client_secret = '4b13f90aa5c7f2c7663ba25ca020660f';

	$config = array();
	$config['appId'] = '1000502090089422';
	$config['secret'] = '4b13f90aa5c7f2c7663ba25ca020660f';
	$config['fileUpload'] = false; // optional

	$fb = new Facebook($config);

	if(strlen($client->client_id) == 0
	|| strlen($client->client_secret) == 0)
		die('Please go to Facebook Apps page https://developers.facebook.com/apps , '.
			'create an application, and in the line '.$application_line.
			' set the client_id to App ID/API Key and client_secret with App Secret');

	/* API permissions
	 */
	$client->scope = 'email';
	
	if(($success = $client->Initialize()))
	{
		if(($success = $client->Process()))
		{
			if(strlen($client->access_token))
			{
				$success = $client->CallAPI(
					'https://graph.facebook.com/me', 
					'GET', array(), array('FailOnAccessError'=>true), $user);

				// define your POST parameters (replace with your own values)
				$params = array(
				  "access_token" => $client->access_token, // see: https://developers.facebook.com/docs/facebook-login/access-tokens/
				  "message" => "Here is a blog post about auto posting on Facebook using PHP #php #facebook",
				  "link" => "http://www.pontikis.net/blog/auto_post_on_facebook_with_php",
				  "picture" => "http://i.imgur.com/lHkOsiH.png",
				  "name" => "How to Auto Post on Facebook with PHP",
				  "caption" => "www.pontikis.net",
				  "description" => "Automatically post on Facebook with PHP using Facebook PHP SDK. How to create a Facebook app. Obtain and extend Facebook access tokens. Cron automation."
				);

			}
		}
		$success = $client->Finalize($success);
	}
	if($client->exit)
		exit;
	if($success)
	{
?>
<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN">
<html>
<head>
<title>Facebook OAuth client results</title>
</head>
<body>
<?php
		echo '<h1>', HtmlSpecialChars($user->name), 
			' you have logged in successfully with Facebook!</h1>';
		echo '<pre>', HtmlSpecialChars(print_r($user, 1)), '</pre>';
		echo '<pre>', HtmlSpecialChars(print_r($client, 1)) ,'</pre>';
		try {
		  $ret = $fb->api('/'.$user->id.'/feed', 'POST', $params);
		  echo 'Successfully posted to Facebook';
		} catch(Exception $e) {
		  echo $e->getMessage();
		}


?>
</body>
</html>
<?php
	}
	else
	{
?>
<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN">
<html>
<head>
<title>OAuth client error</title>
</head>
<body>
<h1>OAuth client error</h1>
<pre>Error: <?php echo HtmlSpecialChars($client->error); ?></pre>
</body>
</html>
<?php
	}

?>