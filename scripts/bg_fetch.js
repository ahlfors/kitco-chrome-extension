function kitco_fetch( callback ){

	$.ajax({
		url: "https://cors-anywhere.herokuapp.com/http://www.kitco.com/market/",
		type: 'get',
		async: false,
		success: function( data ){
			callback( data );
		},
		fail: function( resp ){
			console.log("problem getting kitco page: " + resp );
		}
	})

}

function onRequest( request, sender, callback ){
	if( request.action == 'fetch_kitco' )
		kitco_fetch( callback );
}

chrome.extension.onRequest.addListener( onRequest );
