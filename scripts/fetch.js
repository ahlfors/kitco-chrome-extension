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
    var el = $('<div></div>');
    var gold_bid = $(data).find('#wsp-AU-bid').html();
    var gold_rawdelta = $(data).find('#wsp-AU-change-percent').html();
    var silver_bid = $(data).find('#wsp-AG-bid').html();
    var silver_rawdelta = $(data).find('#wsp-AG-change-percent').html();

    el.html( gold_rawdelta );
    var gold_delta = $('p', el).text();
    el.html( silver_rawdelta );
    var silver_delta = $('p', el).text();


	$('#content').html( 'Gold: ' + gold_bid + ' (' + gold_delta + ')<br/>Silver: ' + silver_bid + ' (' + silver_delta + ')' );

}

$(document).ready(function(){
	fetch_kitco();
});

