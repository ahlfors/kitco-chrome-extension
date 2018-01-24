function fetch_kitco()
{
	chrome.extension.sendRequest( {'action': 'fetch_kitco', 'url': 'http://kitco.com'},
		function( response ){
			display_gold_silver( response );
		}
	);
}

function display_gold_silver( data )
{
	console.log("display_gold_silver() received data: " + data );
	var gold_bid = $(data).find('#AU-bid').text();
	var gold_ask = $(data).find('#AU-ask').text();
	$('#content').html( 'bid was: ' + gold_bid + '<br/>ask was: ' + gold_ask );
}

$(document).ready(function(){
	fetch_kitco();
});

