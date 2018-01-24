 /*
 *
 */

var RTOO, mockObj;

class MockedSystems {

	constructor()
	{
		this.mocked_systems = {};
	}

	get_mocked_systems()
	{
		var inst = RTOO;
		var me = this;
		var req_data = {
			RazorToolAPICommand: 'GetMockedNodes'
		};

		$.ajax({
			url: "/widgets/razor_metadata_tool/php/razor.php",
			type: 'get',
			async: false,
			data: req_data,
			success: function(data){
				var pdata = JSON.parse( data );
				for( var z = 0; z < pdata['hostnames'].length; z++ ){
					// this.system_list[z].u_dns_host_name + "</option>\n";
					inst.system_list.push( {u_dns_host_name: pdata['hostnames'][z]} );
					me.mocked_systems[pdata['hostnames'][z]] = true;
				}
			},
			fail: function(response){
				console.log("problem getting mocked nodes: " + JSON.stringify(response) );
			}
		})

	}

	get_mocked_nic_data()
	{
		// Mocked-out non-CMDB systems
		var inst = RTOO;
		var hname = inst.selected_system_metadata["u_dns_host_name"];
		// var mocked_adapter_url = '/widgets/razor_metadata_tool/php/get_mocked_adapters.php?hostname=' + hname;
		var mocked_adapter_url = '/widgets/razor_metadata_tool/php/razor.php';
		var adata = {
			RazorToolAPICommand: 'GetMockedAdapters',
			RazorToolAPIRequestData: {
				hostname: hname
			}
		}

		console.log("get_mocked_nic_data() mocked url: " + mocked_adapter_url + " and metadata " + JSON.stringify(this.selected_system_metadata) );

		$.get(mocked_adapter_url, adata, function(data){
			var otype = Object.prototype.toString.call( data );
			console.log("network_adapters() mocked function: data returned was of type " + otype + " " + data);
			var pdata = JSON.parse( data );

			if( Object.keys( pdata ).includes( 'interface_data' ) ){
				var ks = Object.keys( pdata['interface_data'] );

				for( var z = 0; z < ks.length; z++ ){
					inst.selected_system_network_data[ks[z]] = {};
					var idat = pdata['interface_data'][ks[z]];
					var nks = Object.keys( idat );
					for( var y = 0; y < nks.length; y++ ){
						console.log("mocked_adapter(): adding " + ks[z] + " key " + nks[y] + " to " + idat[nks[y]]);
						inst.selected_system_network_data[ks[z]][nks[y]] = idat[nks[y]];
					}
				}
				inst.build_host_metadata_form();
			}

		});

	}

}

class RazorMetadataTool {

	constructor()
	{
		this.existing_node_name = '';
		this.existing_node_hostname = '';
		this.is_existing_node = false;
		this.external_object = null;
		this.selected_os = null;
		this.system_list = [];
		this.load_status = {
			pct: 0,
			items: {
				cmdb_entries: {
					loaded: false,
					gain: 100
				}
			}
		};
		this.selected_system_metadata = {};
		this.selected_system_network_data = {};
		this.razor_api_params = {};
		this.razor_node_name = '';
		this.razor_schema_existing_node = '';
		this.node_metadata_schema = {};
		this.razor_schema_method = '';
		this.schema_form_row_types = {};
		this.schema_generate_form_data = {};
		this.schema_obj_refs = {};
		this.schema_obj_expand_divs = {};
		this.schema_definition = {};
		this.dynamic_schema_defs = {};
		this.schema_name_policy_map = {};
	}

	build_host_metadata_form()
	{
		
		$('#host-configuration-header').html( 'System Metadata for ' +
				this.selected_system_metadata['u_dns_host_name'] );
		$('#configform-hostname').html('Selected Hostname: ' +
				this.selected_system_metadata['u_dns_host_name'] );

		var dhcp_string = '<option value="">Select MAC Address</option>\n';
		var boot_string = '';

		var key_list = Object.keys(this.selected_system_network_data);
		for( var z = 0; z < key_list.length; z++ ){
			console.log("buildhostmetadata:" + key_list[z]);
			dhcp_string += '<option value="' +
				this.selected_system_network_data[key_list[z]]['mac_address'] + '">' +
				this.selected_system_network_data[key_list[z]]['mac_address'] + ' (Device:' +
						key_list[z] + ")</option>\n";
		}
		$('#configform-maclist').html( dhcp_string );


		$('#initial-pageload-div').hide();
		$('#host-selection-form').hide();
		$('#configform-mac-selection-listing').hide();
		$('#metadata-editor-container-div').hide();

		$.ajax({
			url: 'api/razor_metadata_tool/razor_metadata_fetch',
			dataType: 'json',
			async: false,
			success: function( http_schema ){
				var inst = RTOO;
				var external_js = '';
				console.log("build_host_metadata_form() successful ajax call: " + JSON.stringify( http_schema ) );

				var akeys = Object.keys(http_schema);
				for( var z = 0; z < akeys.length; z++ ){
					if( http_schema[akeys[z]]['schema_name'] != inst.selected_os )
						continue;
					external_js = http_schema[akeys[z]]['schema_code_include'];
					console.log("build_host_metadata_form() need to load: " + external_js );
					inst.razor_api_params = http_schema[akeys[z]]['schema_definition'];
					inst.razor_api_params['razor_policy'] =
						inst.schema_name_policy_map[inst.selected_os];
					console.log("build_host_metadata_form(): set razor_policy to " +
						inst.razor_api_params['razor_policy'] );
					break;
				}

				if( external_js.length > 0 ){
					$.ajax({
						url: external_js, 
						dataType: 'script',
						async: false,
						success: function( data, textStatus, jqxhr ){
							console.log("build_host_metadata_form() loaded " + external_js );
						},
						error: function( xhr, hstatus, error){
							console.log("build_host_metadata_form() failed " + JSON.stringify(xhr) + ', ' + hstatus + ', ' + error );
						}
					});
				}

				inst.dynamic_schema_defs = http_schema;

			}
		});

		var sdata = this.dynamic_schema_defs;
		var skeys = Object.keys( sdata );
		var form_defs, html_data;

		for( var z = 0; z < skeys.length; z++ ){
			if( sdata[skeys[z]]['schema_name'] != this.selected_os )
				continue;
			console.log("build_host_metadata_form() found dynamic schema data for: " +
				sdata[skeys[z]]['schema_name'] + ' with keys ' +
				Object.keys(sdata[skeys[z]]) );
			form_defs = sdata[skeys[z]]['draw_form_data'];
			break; // right?
		}

		html_data = this.draw_form_recursive( form_defs, true );

		$('#host-configuration-form').append( html_data );
		$('#host-configuration-form').show();
		// this is "shown," which is too bad...we'd prefer a checker function
		var dispHost = this.selected_system_metadata['u_dns_host_name'];
		$('#submissionform-button').html('Submit Metadata for ' + dispHost + ' to Razor');
		$('#host-submission-form').show();
		// $('#submissionform-button').prop("disabled", true);

	}

	draw_form_recursive( obj, top_level )
	{
		var form_html = '';
		var keys = Object.keys( obj );

		console.log("draw_form_recursive() called with " + JSON.stringify(obj) + " and " + JSON.stringify(keys) );

		for( var z = 0; z < keys.length; z++ ){
			if( Object.keys( obj[keys[z]] ).includes('object_label') ){
				console.log("draw_form_recursive() got an object for: " + keys[z]);
				if( top_level )
					form_html += '<div class="row razor_metadata_tool_top_objectpad">' + "\n";
				else
					form_html += '<div class="row razor_metadata_tool_inner_objectpad">' + "\n";

				form_html += '<div class="row">' + "\n";
				form_html += '<h4>' + obj[keys[z]]['object_label'] + "</h4>\n";
				form_html += '</div>' + "\n";

				delete( obj[keys[z]]['object_label'] );
				form_html += this.draw_form_recursive( obj[keys[z]], false );
				form_html += "</div>\n";

			}
			else{
				form_html += '<div class="row">' + "\n";

				switch( obj[keys[z]]['input_type'] ){
					case 'boolean':
						form_html += '<select class="form-control" id="' + keys[z] + '"';

						if( obj[keys[z]]['change_handler'] )
							form_html += ' onchange="' + obj[keys[z]]['change_handler'] + '">';
						else
							form_html += '>';

						if( obj[keys[z]]['input_label'] )
							form_html += '<option value="">' + obj[keys[z]]['input_label'] +
								'</option>';

						form_html += '<option value="true">True</option>' + "\n";
						form_html += '<option value="false">False</option>' + "\n";
						form_html += '</select>';

						break;
					case 'single-select':
						form_html += '<select class="form-control" id="' + keys[z] + '"';

						if( obj[keys[z]]['change_handler'] )
							form_html += ' onchange="' + obj[keys[z]]['change_handler'] + '">';
						else
							form_html += '>';

						if( obj[keys[z]]['input_label'] )
							form_html += '<option value="">' + obj[keys[z]]['input_label'] + '</option>';

						if( obj[keys[z]]['input_source'] ){
							var form_add = eval( obj[keys[z]]['input_source'] );
							form_html += form_add;
						}

						form_html += '</select>';
						break;
					case 'multi-select':
						form_html += '<div class="input-group">' + "\n";
						form_html += '<span class="input-group-addon">';
						form_html += obj[keys[z]]['input_label'];
						form_html += '</span>';
						form_html += '<select class="form-control" id="' + keys[z] +
							'" onchange="' + obj[keys[z]]['change_handler'] + '" multiple>';
						/*
						  the regular expression right below seems very delicate, but it is
						  meant to distinguish between "datasources" in the form of (already
						  loaded) JavaScript functions and ones that require an external
						  ajax GET request.
						*/
						if( obj[keys[z]]['input_source'].match(/^\S+\./) ){
							// we have a javascript function that builds our options list
							form_html += eval( obj[keys[z]]['input_source'] );
						}
						else{
							// we have a call-out to some external source for it--it's gotta
							// get a GET for now, but it could maybe something else later
							// it does to return a string of HTML option tags
							$.ajax({
								url: obj[keys[z]]['input_source'],
								type: 'GET',
								async: false,
								success: function( html_response ){
									console.log("draw_form_recursive() successful ajax call for: " + obj[keys[z]]['input_source']);
									if( html_response.length > 0 )
										form_html += html_response;
								}
							});
						}
						form_html += '</select>'
						form_html += '</div>' + "\n"; // input-group
						break;
					case 'text':
						form_html += '<input type="text" placeholder="';
						form_html += obj[keys[z]]['placeholder'];
						form_html += '" class="form-control" ';
						form_html += 'id="' + keys[z] + '" onchange="';
						form_html += obj[keys[z]]['change_handler'] + '"/>';
						break;
				}

				form_html += '</div>' + "\n"; // row
			}
		}

		return( form_html );

	}

	process_schema_submit()
	{
		if( this.razor_schema_method === 'server' ){
			// get data blob, cycle through it and wipe or blank-out the values
			// for strings and numbers, this is easy: '' or nil
			// for arrays, we want a blank array for one-dimensional arrays: []
			// for multi-dimensional arrays, we want recursion
			var url = "/widgets/razor_metadata_tool/php/razor.php";
			var gdata = {
				RazorToolAPICommand: 'GetExistingNode',
				RazorToolAPIRequestData: {
					node: this.razor_schema_existing_node
				}
			};
			$.ajax({
				url: url,
				type: 'get',
				data: gdata,
				dataType: 'json',
				async: false,
				success: function(data){
					var inst = RTOO;
					// var tmpobj = JSON.parse( data );
					var tmpobj = data;
					var tmpkeys = Object.keys( tmpobj.metadata );
					inst.node_metadata_schema = tmpkeys.length > 0 ? tmpobj.metadata : {};
					inst.json_blob_strip();
				}
			});
		}
		else if( this.razor_schema_method === 'json' ){
			// cycle through in-memory blob and wipe the values
			this.json_blob_strip();
		}
		else{
			// problem
		}

		console.log("process_schema_submit() here is your processed get data: " + JSON.stringify(this.node_metadata_schema) );
		// get a copy of our schema to work on
		this.schema_form_draw( undefined );

	}

	json_blob_strip( obj )
	{
		var myobj;
		if( obj )
			myobj = obj;
		else
			myobj = this.node_metadata_schema;

		var tmpkeys = Object.keys( myobj );

		for( var z = 0; z < tmpkeys.length; z++ ){
			var y = Object.prototype.toString.call( myobj[tmpkeys[z]] );
			// console.log("process_schema_submit() processing razor metadata object type " + y );
			switch( y ){
				case '[object Boolean]':
					myobj[tmpkeys[z]] = true;
				case '[object Number]':
					myobj[tmpkeys[z]] = 0;
					break;
				case '[object String]':
					myobj[tmpkeys[z]] = '';
					break;
				case '[object Object]':
					this.json_blob_strip( myobj[tmpkeys[z]] );
					break;
				case '[object Array]':
					console.log('process_schema_submit() working on array ' + tmpkeys[z] );
					this.array_strip_handler( myobj[tmpkeys[z]] );
					break;
					// a one-dimensional array can be blanked-out ([], {}) and we're done
				default:
					break;
			}
		}

		console.log("json_blob_strip() (top level): here is the stripped object " + JSON.stringify(this.node_metadata_schema) );

	}

	array_strip_handler( arr )
	{
		var ks = Object.keys( arr );
		var mdim = false;

		console.log("array_strip_handler(): object is " + JSON.stringify(arr) );

		for( var z = 0; z < ks.length; z++ ){
			var y = Object.prototype.toString.call( arr[ks[z]] );
			switch( y ){
				case '[object Boolean]':
					arr[ks[z]] = true;
					break;
				case '[object Number]':
					arr[ks[z]] = 0;
					break;
				case '[object String]':
					arr[ks[z]] = '';
					break;
				case '[object Object]':
					this.json_blob_strip( myobj[tmpkeys[z]] );
					break;
				case '[object Array]':
					console.log('array_strip_handler() working on array ' + ks[z] );
					mdim = true;
					this.array_strip_handler( arr[ks[z]] );
					break;
				default:
					break;
			}
		}

		if( mdim == false ){
			console.log("array_strip_handler(): emptying single-dimension array");
			while( arr.length ){
				arr.pop();
			}
			// the following line is necessary because empty arrays get wiped out when they get 
			// submitted to the backend, which as of now is the dashboard server
			arr[0] = '';
		}

	}

	build_iselect( col3, target_obj )
	{
		return '<select onchange="RTOO.schema_itype_handler( &quot;' + col3 + '&quot;, &quot;' +
			target_obj + '&quot;, this )">' +
			'<option value="">Select Input</option>' + "\n" +
			'<option value="single-select">Single Select</option>' + "\n" +
			'<option value="multi-select">Multi Select</option>' + "\n" +
			'<option value="text">Text</option>' + "\n" +
			'<option value="pre-set-hostname">Pre-Selected (Host)</option>' + "\n" +
			'<option value="pre-set-bootmac">Pre-Selected (MAC Address)</option>' + "\n" +
			'<option value="derived">Code-Derived</option>' + "\n" +
			'</select>' + "\n";
	}

	schema_name_handler( iput )
	{
		var sname = iput.value;
		var txt_html = '<button class="submit-button btn btn-primary" onClick="RTOO.schema_final_submit_handler()">Click Here to Submit ' +  sname + '</button>';
		this.schema_definition['schema_name'] = sname;
		$('#schema_form_submit_button_div').html( txt_html );
		$('#schema_form_submit_button_div').show();
	}

	schema_policy_handler( iput )
	{
		this.schema_definition['razor_policy'] = iput.value;
	}

	schema_source_handler( iput )
	{
		this.schema_definition['schema_code_include'] = iput.value;
	}

	/*
	* This function below needs more and better form_checker()-type logic so we can verify
	* that the form has been completed before submission, but at this point (20170717) there
	* is a need to keep moving.
	*/

	schema_final_submit_handler()
	{
		var inst = this;
		var sname = Object.keys( inst.schema_definition );

		if( sname.length > 0 ){
			inst.schema_definition['draw_form_data'] = inst.schema_generate_form_data;
			inst.schema_definition['schema_definition'] = inst.node_metadata_schema;

			$.post('api/razor_metadata_tool/razor_metadata_submit', inst.schema_definition )
				.done( function(response){
					var div_html = '<h4>Schema Definition Successfully Created for ' +
						inst.schema_definition['schema_name'] + "</h4>\n";

					console.log("schema_final_submit_handler() got response: " + response);
					inst.finish_successful_splash_screen( div_html );
				})
				.fail( function( xhr, st, error ){
					console.log("schema_final_submit_handler() failed with status " + st + ": " + error);
				});
		}

	}

	schema_form_draw( obj )
	{
		var build_iselect = this.build_iselect;
		var ks, div_html = '', obj_abs, obj_marker, recurs;
		var obj_hide_ids = [];

		if( obj === undefined ){
			recurs = false;
			obj_abs = this.node_metadata_schema;
			ks = Object.keys( obj_abs );
			div_html = '<div class="container">' + "\n";
			obj_marker = sjcl.codec.hex.fromBits( 
					sjcl.hash.sha256.hash( div_html + Math.random() + Date.now() + JSON.stringify(ks) ) );

			this.schema_obj_refs[obj_marker] = this.schema_generate_form_data;

			console.log("schema_form_draw(): top level object reference: " + obj_marker + " JSON " + JSON.stringify(this.schema_obj_refs) + " that points to this JSON " + JSON.stringify(this.schema_generate_form_data) );

			div_html += '<div class="row">' + "\n";
			div_html += '<div class="col-md-12">' +
				this.schema_text_field( 'schema_name', '', 'Please Enter a Name for this Schema Definition', 'RTOO.schema_name_handler(this)') + "</div>\n";
			div_html += "</div>\n";

			div_html += '<div class="row">' + "\n";
			div_html += '<div class="col-md-12">' +
				this.schema_text_field( 'razor_policy', '', 'Please Enter the Razor Policy Associated with this Schema Definition', 'RTOO.schema_policy_handler(this)') + "</div>\n";
			div_html += "</div>\n";

			div_html += '<div class="row">' + "\n";
			div_html += '<div class="col-md-12">' +
				this.schema_text_field( 'javascript_source', '', 'Optional: Enter a JavaScript Source File Path for Inclusion', 'RTOO.schema_source_handler(this)') + "</div>\n";
			div_html += "</div>\n";
			div_html += '<div class="row">' + "\n";
			div_html += '<div class="col-md-3">Field Name (Type)</div>' + "\n";
			div_html += '<div class="col-md-3">Input Type</div>' + "\n";
			div_html += '</div>' + "\n";

			div_html += '<div class="row">' + "\n";
			div_html += '<div class="col-md-12"><hr size="5"/></div>' + "\n";
			div_html += '</div>' + "\n";
		}
		else{
			var container_div_id = obj['id'] + '_container';
			recurs = true;
			// obj keys -> id, obj, marker
			obj_abs = obj['obj'];
			obj_marker = obj['marker'];
			ks = Object.keys( obj_abs );
			this.schema_obj_expand_divs[obj_marker] = [];

			div_html += '<div class="row">' + "\n";
			div_html += '<div class="container" id="' + container_div_id + '">' + "\n";
			obj_hide_ids.push( container_div_id );
		}

		for( var z = 0; z < ks.length; z++ ){
			this.schema_obj_refs[obj_marker][ks[z]] = {};
			var col3_div = obj_marker + '|' + ks[z] + "_col3";
			var col4_div = obj_marker + '|' + ks[z] + "_col4";
			var col2_div = '';
			var sub_marker = '';
			var is_object = false;
			var otype = Object.prototype.toString.call( obj_abs[ks[z]] );

			if( recurs )
				col2_div = obj_marker + '|' + ks[z] + "_col2";

			this.schema_form_row_types[obj_marker + ks[z]] = otype;

			div_html += '<div class="row">' + "\n";
			switch( otype ){
				case '[object Boolean]':
				case '[object Number]':
					// For now, Booleans are Numbers and Numbers at least should be Strings
					this.schema_obj_refs[obj_marker][ks[z]]['input_type'] = 'boolean';
					if( recurs === false ){
						div_html += '<div class="col-md-3">' + ks[z] + ' (Boolean)</div>';
						div_html += '<div class="col-md-3">Boolean Selectbox</div>';
						div_html += '<div class="col-md-3" id="' + col3_div  + '">' + "\n";
						div_html += this.schema_text_field( col3_div, '', 'Boolean Label Text',
								'RTOO.boolean_label_text_expand(&quot;' + obj_marker + 
									'&quot;, this)' ) + '</div>';
						div_html += '<div class="col-md-3" id="' + col4_div  + '"></div>';
					}
					else{
						this.schema_obj_expand_divs[obj_marker].push( col2_div );
						div_html += '<div class="col-md-3">' + ks[z] + ' (Boolean)</div>';
						div_html += '<div class="col-md-3">Boolean Selectbox</div>';
						div_html += '<div class="col-md-3" id="' + col3_div  + '">' + "\n";
						div_html += RTOO.schema_text_field( col3_div, '', 'Boolean Label Text',
								'RTOO.boolean_label_text_expand(&quot;' + obj_marker + 
									'&quot;, this)' ) + '</div>';
						div_html += '<div class="col-md-3" id="' + col4_div  + '"></div>';
					}
					break;
				case '[object String]':
					if( recurs === false ){
						div_html += '<div class="col-md-3">' + ks[z] + ' (String)</div>';
						div_html += '<div class="col-md-3">' + build_iselect(col3_div, obj_marker) +
							'</div>';
						div_html += '<div class="col-md-3" id="' + col3_div  + '"></div>';
						div_html += '<div class="col-md-3" id="' + col4_div  + '"></div>';
					}
					else{
						this.schema_obj_expand_divs[obj_marker].push( col2_div );
						div_html += '<div class="col-md-3">' + ks[z] + ' (String)</div>';
						div_html += '<div class="col-md-3" id="' + col2_div + '"></div>';
						div_html += '<div class="col-md-3" id="' + col3_div  + '"></div>';
						div_html += '<div class="col-md-3" id="' + col4_div  + '"></div>';
					}
					break;
				case '[object Array]':
					if( recurs === false ){
						div_html += '<div class="col-md-3">' + ks[z] + ' (Array)</div>';
						div_html += '<div class="col-md-3">Select Box</div>';
						div_html += '<div class="col-md-3" id="' + col3_div  + '">' + 
							this.schema_text_field( col3_div, '', 'Select Box Label Text',
								'RTOO.array_label_text_expand(&quot;' + obj_marker + 
									'&quot;, this)' ) + '</div>';
						div_html += '<div class="col-md-3" id="' + col4_div  + '"></div>';
					}
					else{
						this.schema_obj_expand_divs[obj_marker].push( col2_div );
						div_html += '<div class="col-md-3">' + ks[z] + ' (Array)</div>';
						div_html += '<div class="col-md-3">Select Box</div>';
						div_html += '<div class="col-md-3" id="' + col3_div  + '"></div>';
						div_html += '<div class="col-md-3" id="' + col4_div  + '"></div>';
						break;
					}
					break;
				case '[object Object]':
					is_object = true;
					sub_marker = sjcl.codec.hex.fromBits( sjcl.hash.sha256.hash( div_html + 
								Math.random() + Date.now() + JSON.stringify(ks[z]) ) );

					this.schema_obj_refs[sub_marker] = this.schema_obj_refs[obj_marker][ks[z]];

					if( recurs === false ){
						div_html += '<div class="col-md-3">' + ks[z] + ' (Object)</div>';
						div_html += '<div class="col-md-3">N/A</div>';
						div_html += '<div class="col-md-3">' + 
							this.schema_text_field( col3_div, '', 'Object Group Label Text',
									'RTOO.object_label_text_expand(&quot;' + sub_marker +
										'&quot;, this)' ) + '</div>';
						div_html += '<div class="col-md-3" id="' + col4_div  + '"></div>';
					}
					else{
						div_html += '<div class="col-md-3">' + ks[z] + ' (Object)</div>';
						div_html += '<div class="col-md-3">N/A</div>';
						div_html += '<div class="col-md-3" id="' + col3_div  + '">' + 
								this.schema_text_field( col3_div, '', 'Object Group Label Text',
									'RTOO.object_label_text_expand(&quot;' + sub_marker +
										'&quot;, this)' ) + '</div>';
						div_html += '<div class="col-md-3" id="' + col4_div  + '"></div>';
					}
					break;
				default:
					// nuttin
					break;
			}
			div_html += "</div>\n"; // row
			div_html += '<div class="row"> </div>' + "\n";
			if( is_object ){
				var ret = [];
				var argobj = {
					id: ks[z],
					obj: obj_abs[ks[z]],
					marker: sub_marker
				};
				// obj keys -> id, obj, marker
				ret = this.schema_form_draw( argobj );
				if( ret[0].length )
					for( var y = 0; y < ret[0].length; y++ )
						obj_hide_ids.push( ret[0][y] );
				div_html += ret[1];
				is_object = false;
			}
		}

		if( recurs === false ){
			div_html += '<div class="row">' + "\n";
			div_html += '<div class="col-md-12">' + "\n";
			div_html += '<div class="submit-button-wrapper" id="schema_form_submit_button_div">' + "\n";
			div_html += '</div>' + "\n";
			div_html += '</div>' + "\n";
			div_html += '</div>' + "\n"; // row
			div_html += "</div>\n"; // container

			$('#initial-loading').hide();
			$('#system-selection-form').hide();
			$('#host-configuration-form').hide();
			$('#host-submission-form').hide();
			$('#initial-pageload-div').hide();
			$('#schemadef-buttondiv').hide();
			$('#schemadef-button').prop( "disabled", true );

			// target id: schema-build-div
			$('#schema-build-div').html(div_html);
			for( var z = 0; z < obj_hide_ids.length; z++ ){
				console.log("schema_form_draw() hiding divId: " + obj_hide_ids[z] );
				$('#' + obj_hide_ids[z] ).hide();
			}
			console.log("schema_form_draw() obj_hide_ids: " + JSON.stringify(obj_hide_ids[z]) );
			$('#schema-build-div').show();
		}
		else{
			div_html += "</div></div>\n"; // row and container closure from above
			return( [obj_hide_ids, div_html] );
		}

	}

	object_label_text_expand( target, txt )
	{
		var jname = txt.id.replace( /_col3$/, '' ).split('|', 2)[1]; // delicate?
		var jval = txt.value;
		var showdiv = jname + '_container';

		// console.log("object_label_text_expand() received jname " + jname + ", val " + jval + " and target: " + target + " and our expand divs has " + RTOO.schema_obj_expand_divs[target].length + " items and check this out: " +  JSON.stringify(RTOO.schema_obj_expand_divs) );
		console.log("object_label_text_expand() received jname " + jname + ", val " + jval + " and target: " + target + " and schema_obj_refs for our target is: " + this.schema_obj_refs[target] + " and its keys are: " + Object.keys(this.schema_obj_refs[target]).join(", ") );

		this.schema_obj_refs[target]['object_label'] = jval;

		for( var z = 0; z < this.schema_obj_expand_divs[target].length; z++ ){
			var col2 = this.schema_obj_expand_divs[target][z];
			var col3 = col2.replace(/2$/, '3');
			var row = '';
			var tmp = col2.split('|', 2)[1];
			
			row = tmp.replace(/_col2/, '');

			// our pre-set row type
			var row_type = this.schema_form_row_types[target + row];

			// again, this is too destructive?...not for now
			// delete( RTOO.schema_form_row_types[target + row] );

			console.log("object_label_text_expand() building iput select for: " + col3);

			if( ['[object String]', '[object Number]'].includes( row_type ) ){
				// this builds a column 2 select box for rows of type primitive (string/number)
				$( document.getElementById(col2) ).html( this.build_iselect(col3, target) );
			}
			else if( row_type === '[object Array]' )
				// this builds a column 3 text input element for rows of type array
				$( document.getElementById(col3) ).html(
						this.schema_text_field( col3, '', 'Select Box Label Text',
							'RTOO.array_label_text_expand(&quot;' + target + '&quot;, this)' ) );

			console.log("object_label_text_expand() setting row type key " + target + row +
					" to value " + row_type );
			this.schema_form_row_types[target + row] = row_type;

		}

		$('#' + showdiv).show();

	}

	schema_text_field( nam, typ, msg, func )
	{
		var hold = nam;
		var octxt = '';

		if( typ.length > 0 )
			hold += typ;

		if( func.length > 0 )
			octxt = ' onchange="' + func + '"';

		return '<input type="text" class="form-control" id="' + hold + '" placeholder="' + msg +
			'"' + octxt + '/>';
	}

	schema_itype_handler( name, target_object, val )
	{
		// name is the column 3 name (something_col3), val is type of input
		var value = val.value;
		var col4_el = name.replace(/3$/, '4');
		var element = '';
		var row_type = '';
		var type_key = '';

		if( name.match(/\|/) ){
			var temp = name.split('|', 2);
			element = temp[1].replace(/_col3$/, '');
		}
		else{
			element = name.replace(/_col3$/, '');
		}

		type_key = target_object + element;

		row_type = this.schema_form_row_types[type_key];

		// console.log('schema_itype_handler() called with name: ' + name + ' and target ' + target_object + ' and val ' + val.value + '...element is ' + element + '...and our type is ' + row_type  + "and our type key is " + type_key + " and our types thing is " + JSON.stringify( RTOO.schema_form_row_types)  );

		if( value === 'text' && (row_type === '[object String]' || row_type == '[object Number]') ){
			$( document.getElementById(name) ).html( this.schema_text_field( name, '', 'Enter Placeholder Text',
					   'RTOO.primitive_placeholder_text_save(&quot;' + name + '&quot;, &quot;' + target_object + '&quot;, ' +
						   'this)'	) );
			$( document.getElementById(name) ).show();
		}
		else if( ['single-select','multi-select'].includes(value) &&
				(row_type === '[object String]' || row_type == '[object Number]') ){

			console.log("schema_itype_handler() set object sub " + element + " input type " + " to " + value + " the larger object looks like: " + JSON.stringify(this.schema_obj_refs[target_object]) );
			this.schema_obj_refs[target_object][element]['input_type'] = value;

			$( document.getElementById(name) ).html( this.schema_text_field( name, '', 'Select Box Label Text',
					   'RTOO.primitive_selectbox_text_expand(&quot;' + name + '&quot;, &quot;' +
						   target_object + '&quot;, this)') );
			$( document.getElementById(name) ).show();
		}
		else if( ['pre-set-hostname','pre-set-bootmac','derived'].includes(value) ){
			// These are special "input types" because the hostname and boot interface values are
			// "special" in the sense that EVERY form will incorporate a hostname and a boot
			// interface MAC address.  The actual variation between forms is what gets appended
			// to these values.  How to express that in
			// RTOO.schema_obj_refs[target_object][element]?  Right now just set it to the value,
			// don't do anything else and see if something breaks.
			this.schema_obj_refs[target_object][element]['input_type'] = value;
		}
		else{
			// this is too destructive
			// delete( RTOO.schema_obj_refs[target_object] );
			$( document.getElementById(name) ).hide();
			$( document.getElementById(col4_el) ).hide();
		}

	}

	primitive_selectbox_text_expand( name, target, div )
	{
		var jname = '';
		var col4 = '';
		var src = '';
		var hdl = '';

		if( name.match(/\|/) ){
			var temp = name.split('|', 2)[1];
			jname = temp.replace(/_col3$/, '');
		}
		else
			jname = name.replace( /_col3$/, '' );

		col4 = name.replace(/3$/, '4'); // div ID for column 4
		src = jname + '_input_source'; // name for input source text box
		hdl = jname + '_change_handler'; // name for change handler text box

		// should we verify that RTOO.schema_obj_refs[target][jname] is in fact a object/hash first?
		// we're relying on the breadcrumb effect to prevent this function from being executed before
		// it gets initialized as above in schema_itype_handler()
		this.schema_obj_refs[target][jname]['input_label'] =  div.value;
		console.log("primitive_selectbox_text_expand() added object sub " + jname + " input_label as " + div.value + ".  Object now looks like this: " + JSON.stringify(this.schema_obj_refs[target]) );

		var col4_html = this.schema_text_field( src, '', 'Enter Data Source',
					   'RTOO.selectbox_datasource(&quot;' + target + '&quot;, this)');
		col4_html += "<br/>\n";
		col4_html += this.schema_text_field( hdl, '', 'Enter OnChange Handler',
					   'RTOO.onchange_entry_handler(&quot;' + target + '&quot;, this)');

		$( document.getElementById(col4) ).html( col4_html );
		$( document.getElementById(col4) ).show();

	}

	primitive_placeholder_text_save( name, target, div )
	{
		// name comes to us from column 3, so trim the "_col3" piece
		var jname, col4div, hdl;

		if( name.match(/\|/) ){
			jname = name.replace( /_col3$/, '' ).split('|', 2)[1];
			col4div = target + '|' + jname + '_col4';
		}
		else{
			jname = name.replace( /_col3$/, '' );
			col4div = jname + '_col4';
		}

		hdl = jname + '_change_handler';

		console.log("primitive_placeholder_text_save() called with target: " + target + " derived jname as: " + jname + " value is " + div.value);


		/*
		  build and save JSON structure
		*/

		this.schema_obj_refs[target][jname] = {
			input_type: "text",
			placeholder: div.value
		};

		var col4_html = this.schema_text_field( hdl, '', 'Enter OnChange Handler',
					   'RTOO.onchange_entry_handler(&quot;' + target + '&quot;, this)');

		console.log("primitive_placeholder_text_save() here is what we tried to add: " + JSON.stringify(this.schema_obj_refs[target][jname]) + " here is the larger target by reference: " + JSON.stringify(this.schema_obj_refs[target]) );

		console.log("primitive_placeholder_text_save() here is your JSON: " + JSON.stringify(this.schema_generate_form_data) );

		console.log("primitive_placeholder_text_save() here is the ref: " + JSON.stringify(this.schema_obj_refs) );

		$( document.getElementById(col4div) ).html( col4_html );
		$( document.getElementById(col4div) ).show();

	}

	selectbox_datasource( target, idat )
	{
		var id = idat.id;
		var val = idat.value;
		var jname;
	   
		if( id.match(/\|/) )
			jname = id.replace(/_input_source$/, '' ).split('|', 2)[1];
		else
			jname = id.replace(/_input_source$/, '' );

		console.log("selectbox_datasource() called with target " + target + " and id " + id + " and val " + val );

		console.log("selectbox_datasource() setting object sub " + jname + " sub input_source to " + val );

		this.schema_obj_refs[target][jname]['input_source'] = idat.value;

		console.log("selectbox_datasource() here is the JSON: " + JSON.stringify( this.schema_generate_form_data ) );
	}

	onchange_entry_handler( target, idat )
	{
		var id = idat.id;
		var val = idat.value;
		var jname;
	   
		if( id.match(/\|/) )
			jname = idat.id.replace( /_change_handler$/, '' ).split('|', 2)[1];
		else
			jname = idat.id.replace( /_change_handler$/, '' );

		// console.log("onchange_entry_handler() we got called with target: " + target + " and id " + id + " and val " + val + " and got jame " + jname );

		this.schema_obj_refs[target][jname]['change_handler'] = idat.value;

		console.log("onchange_entry_handler() here is the JSON: " +
				JSON.stringify( this.schema_generate_form_data ) );
	}

	boolean_label_text_expand( target, label )
	{
		var id = label.id;
		var jname = id.replace( /_col3$/, '' );
		var col4 = jname + '_col4'; // div ID for column 4
		var hdl = jname + '_change_handler'; // name for change handler text box
		var object_name = '';
		var html_txt = '';

		object_name = jname.split('|', 2)[1];
		this.schema_obj_refs[target][object_name]['input_label'] = label.value;

		html_txt += this.schema_text_field( hdl, '', 'Enter OnChange Handler',
					   'RTOO.onchange_entry_handler(&quot;' + target + '&quot;, this)');

		$( document.getElementById(col4) ).html( html_txt );
		$( document.getElementById(col4) ).show();


	}

	array_label_text_expand( target, label )
	{
		var id = label.id;
		var jname = id.replace( /_col3$/, '' );
		var col4 = jname + '_col4'; // div ID for column 4
		var src = jname + '_input_source'; // name for input source text box
		var hdl = jname + '_change_handler'; // name for change handler text box
		var object_name = '';
		var html_txt = '';

		object_name = jname.split('|', 2)[1];


		this.schema_obj_refs[target][object_name] = {
			input_type: "multi-select",
			input_label: label.value
		};

		html_txt += this.schema_text_field( src, '', 'Enter Data Source',
					   'RTOO.selectbox_datasource(&quot;' + target + '&quot;, this)' );
		html_txt += "<br/>\n";
		html_txt += this.schema_text_field( hdl, '', 'Enter OnChange Handler',
					   'RTOO.onchange_entry_handler(&quot;' + target + '&quot;, this)');

		$( document.getElementById(col4) ).html( html_txt );
		$( document.getElementById(col4) ).show();

	}

	node_schema_form_checker()
	{
		var form_ready = true;
		var kct = Object.keys( this.node_metadata_schema ).length;
		var elen = this.razor_schema_existing_node.length;

		if( kct > 0 && elen > 0 ){
			// both are set...one needs to not be
			console.log('node_schema_form_checker(): both are set');
			form_ready = false;
		}
		else if( kct > 0 && elen === 0 ){
			// valid JSON file was supplied
			console.log('node_schema_form_checker(): metadata set in file');
			this.razor_schema_method = 'json';
		}
		else if( kct === 0 && elen > 0 ){
			// existing node on razor server to lookup
			console.log('node_schema_form_checker(): existing node lookup set');
			this.razor_schema_method = 'server';
		}
		else{
			// logically, at least, both form elements are not set
			console.log('node_schema_form_checker(): no data for either: ' + Object.keys( this.node_metadata_schema ).join(',') );
			form_ready = false;
		}

		if( form_ready == true ){
			if( this.razor_schema_method == 'server' ){
				$('#schemadef-button').html('Click Here to Retrieve ' + 
						this.razor_schema_existing_node + ' Schema');
			}
			else{
				$('#schemadef-button').html('Click Here to Process JSON Schema');
			}

			$('#schemadef-buttondiv').show();
			$('#schemadef-button').prop("disabled", false);

		}

	}

	node_schema_file_handler()
	{
		var input = $('#schemadef-metadata')[0].files[0];

		if( typeof(input) == 'undefined' ){
			return null;
		}

		var reader = new FileReader();

		reader.onload = function( e ){
			var inst = RTOO;
			if( e.target.result ){
				try{
					inst.node_metadata_schema = JSON.parse( e.target.result );
				}
				catch( e ){
					alert("Please select a valid JSON file");
				}
				console.log('node_schema_file_handler(): here is your object: ' + this.node_metadata_schema );
				inst.node_schema_form_checker();
			}
		}

		reader.readAsText( input );

	}

	node_schema_name_handler()
	{
		this.razor_schema_existing_node = $('#schemadef-lookupnode').val();
		this.node_schema_form_checker();
	}

	metadata_checker()
	{
		var klist = Object.keys( this.razor_api_params );
		var form_ready = true;
		var why = '';
		
		for( var z = 0; z < klist.length; z++ ){
			var y = Object.prototype.toString.call(this.razor_api_params[klist[z]]);
			switch( y ){
				case '[object String]':
				case '[object Array]':
					if( this.razor_api_params[klist[z]].length === 0 ){
						why += klist[z] + ' (' + y + ') was length zero ';
						form_ready = false;
					}
					break;
				case '[object Number]':
					if( this.razor_api_params[klist[z]] === 0 ){
						why += klist[z] + ' (Number) was zero ';
						form_ready = false;
					}
					break;
				case '[object Null]':
					why += klist[z] + ' was null ';
					form_ready = false;
					break;
			}
		}

		// console.log("metadata_checker(): is the form ready?  " + form_ready + ' because: ' + why );
		if( form_ready === true ){
			// $('#host-configuration-form').hide();
			// $('#host-configuration-form').show();
			// var sdata = $('#scrollDiv').html();
			// $('#scrollDiv').hide().html(sdata).fadeIn('fast');
			var dispHost = this.selected_system_metadata['u_dns_host_name'];
			$('#host-submission-form').show();
			$('#submissionform-button').prop("disabled", false);
			$('#submissionform-button').html('Submit Metadata for ' + dispHost + ' to Razor');
			console.log("metadata_checker(): form is ready");
		}

	}

	register_node()
	{
		var inst = this;
		var rdata = {
			RazorToolAPICommand: 'RegisterNode',
			RazorToolAPIRequestData: {
				net0: this.razor_api_params['dhcp_mac']
			}
		};

		var mystr = JSON.stringify( rdata );

		console.log("register_node() submitting to razor with: " + mystr );
		
		$.ajax({
			type: 'post',
			url: '/widgets/razor_metadata_tool/php/razor.php',
			data: rdata,
			// contentType: "application/json; charset=utf-8",
			// dataType: 'json',
			async: false,
			success: function(response){
				console.log("register_node() succeeded registering dhcp_mac: " + rdata.RazorToolAPIRequestData['net0'] + "...Server said: " + response );
				var r_json = JSON.parse( response );
				inst.razor_node_name = r_json['name'];
			},
			fail: function( xhr, st, error ){
				console.log("register_node() failed with status " + st + ": " + error);
			}
		});

	}

	node_metadata()
	{
		var inst = this;
		var node_metadata = inst.razor_api_params;

		delete( node_metadata['dhcp_mac'] );

		var post_data = {
			RazorToolAPICommand: 'NodeMetadata',
			RazorToolAPIRequestData: {
				node: inst.razor_node_name,
				update: node_metadata,
				no_replace: false
			}
		};

		$.post('/widgets/razor_metadata_tool/php/razor.php', post_data)
			.done( function(response){
				console.log("node_metadata() got response: " + response);
				inst.existing_node_name = response['name'];
			})
			.fail( function( xhr, st, error ){
				console.log("node_metadata() failed with status " + st + ": " + error);
			});

	}

	do_submit_to_razor()
	{
		var inst = this;
		var div_html;
		var hostname_key = Object.keys(inst.razor_api_params).includes('hostname:') ? 
			'hostname:' : 'hostname';
		var node_name = inst.existing_node_name.length > 0 ? inst.existing_node_name :
			'Razor node name unavailable';

		if( this.is_existing_node === false ){
			div_html = '<h4>Razor Node Successfully Created for ' +
				this.razor_api_params[hostname_key] + ' (' + node_name + ')</h4>';
			this.register_node();
		}
		else{
			div_html = '<h4>Razor Metadata Successfully Updated for ' +
				this.razor_api_params[hostname_key] + ' (' + node_name + ')</h4>';
		}

		this.node_metadata();
		this.finish_successful_splash_screen( div_html );

	}

	finish_successful_splash_screen( html_msg ){

		$('#initial-loading').hide();
		$('#system-selection-form').hide();
		$('#host-configuration-form').hide();
		$('#host-submission-form').hide();
		$('#schemadef-buttondiv').hide();
		$('#schema-build-div').hide();
		$('#metadata-clear-confirm-form').hide();
		$('#metadata-editor-container-div').hide();
		$('#initial-pageload-div').hide();
		$('#schemadef-button').prop( "disabled", true );

		$('#metdata-tool-action-finish-div').html( html_msg );
		$('#metdata-tool-action-finish-div').show();

	}

	sleep(ms)
	{
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	submit_clicked()
	{
		// probably some input verification and other things
	}

	create_alert( str )
	{
		// probably some alerting thing
	};

	build_appliance_list()
	{
		var appliance_html = '<option>Select Hostname</option>';
		var header_message = 'Please Select a Target for ' + this.selected_os + ' Provisioning';

		for( var z = 0; z < this.system_list.length; z++ ){
			appliance_html += '<option value="' + this.system_list[z].u_dns_host_name + '">' + 
				this.system_list[z].u_dns_host_name + "</option>\n";
		}

		$('#host-selection-header').html( header_message );
		$('#form-host-lookup-list').html( appliance_html );

		$('#initial-pageload-div').hide();
		$('#host-configuration-form').hide();
		$('#host-submission-form').hide();

		$('#system-selection-form').show();


	}

	network_adapters()
	{
		var cmdb_network_adapter =
			"api/razor_metadata_tool/cmdb_ci_network_adapter_reader?sys_id=" +
			this.selected_system_metadata["sys_id"];

		$.get(cmdb_network_adapter, function(data){
			var inst = RTOO;
			for( var z = 0; z < data.result.length; z++ ){
				var iname = data.result[z]['name'];
				inst.selected_system_network_data[iname] = {};
				// var oks = Object.keys(data.result[z]).sort();
				var oks = jQuery.grep( Object.keys(data.result[z]).sort(), function( k, i ){
					return( k !== 'name' );
				});
				for( var y = 0; y < oks.length; y++ ){
					console.log("setting " + iname + " key: " + oks[y] + " val: " + data.result[z][oks[y]] );
					inst.selected_system_network_data[iname][oks[y]] = data.result[z][oks[y]];
				}
			}
			inst.build_host_metadata_form();
		})
		.fail(function(response){
			console.log("Nothing in the CMDB for network");
		});

	}

	update_loading_status()
	{
		var l_items = Object.keys(this.load_status.items);

		for( var z = 0; z < l_items.length; z++ ){
			var item = this.load_status.items[l_items[z]];
			if( item.loaded ){
				this.load_status.pct += item.gain;
			}
		}

		$('#initial-progress-bar').html( this.load_status.pct + '%' );
		$('#initial-progress-bar').attr('aria-valuenow', this.load_status.pct);
		$('#initial-progress-bar').attr('style', 'height: 50px; width: '+ this.load_status.pct + '%');

		if( this.load_status.pct >= 100 ){
			setTimeout(function() { $('#initial-loading').fadeOut(100); }, 150 );
		}

	}

	lookupHost()
	{
		var inst = this;
		var hname;

		if( arguments.length == 0 )
			hname = $('#form-host-lookup-list').val();
		else
			hname = arguments[0];

		console.log("lookupHost(): working with hname: " + hname );

		if( mockObj !== undefined ){
			mockObj.get_mocked_systems();

			if( Object.keys( mockObj.mocked_systems ).includes(hname) ){
				console.log("lookupHost(): mocked system");
				inst.selected_system_metadata['u_dns_host_name'] = hname;
				mockObj.get_mocked_nic_data();
				return;
			}
		}

		var cmdb_module_url = "api/razor_metadata_tool/cmdb_module_get_host_data?lookuphost=" + hname;

		$.get(cmdb_module_url, function(data){
			console.log("lookupHost() got real cmdb data " + JSON.stringify(data) + " and adding it to " + JSON.stringify(inst.selected_system_metadata) );
			var oks = Object.keys(data.result[0]).sort();
			for( var y = 0; y < oks.length; y++ ){
				inst.selected_system_metadata[oks[y]] = data.result[0][oks[y]];
			}
			inst.network_adapters();
		})
		.fail(function(response){
			var inst = RTOO;
			inst.create_alert("warning", "No systems found in CMDB!", 3000);
			inst.load_status.items.cmdb_entries.loaded = true;
			inst.selected_system_metadata = {};
		});

	}

	do_schema_submit()
	{
		post_data = {
			test_column_1: 'WAY TO GO, BRO!',
			test_column_2: 'way to go, yo!'
		};

		$.post('api/razor_metadata_tool/brennan_create', post_data)
			.done( function(response){
				console.log("node_metadata() got response: " + response);
			})
			.fail( function( xhr, st, error ){
				console.log("node_metadata() failed with status " + st + ": " + error);
			});

	}

	get_cmdb_entries()
	{
		var inst = this;
		$('#initial-loading').show();
		inst.selected_os = $('#selected-os').val();
		inst.razor_api_params['razor_policy'] = inst.schema_name_policy_map[inst.selected_os];

		console.log("get_cmdb_entries(): Selected OS was " + inst.selected_os + ' razor policy set to ' + inst.razor_api_params['razor_policy'] );
		// Mocked-out non-CMDB systems
		if( mockObj !== undefined )
			mockObj.get_mocked_systems();
		// end Mocked-out non-CMDB systems

		$.get("api/razor_metadata_tool/cmdb_module_get_hosts", function(data) {
			// below is commented-out to support Mocked-out non-CMDB systems
			// inst.system_list = data.result;
			for( var z = 0; z < data.result.length; z++ ){
				inst.system_list.push( data.result[z] );
			}
			inst.load_status.items.cmdb_entries.loaded = true;
			inst.update_loading_status();
			inst.build_appliance_list();
		})
		.fail(function(response) {
			var inst = RTOO;
			inst.create_alert("warning", "No systems found in CMDB!", 3000);
			inst.load_status.items.cmdb_entries.loaded = true;
			// RTOO.update_loading_status();
			// await RTOO.sleep( 1000 );
			inst.system_list = [];
		});

	}

	fill_supported_os( divid )
	{
		var inst = this;
		$.ajax({
			url: "api/razor_metadata_tool/razor_metadata_fetch/",
			type: 'get',
			async: false,
			success: function(data){
				var div_html = '<option value="">Select a Supported OS to Deploy</option>';

				if( data ){
					var oks = Object.keys( data );

					for( var z = 0; z < oks.length; z++ ){
						var sname = data[oks[z]]['schema_name'];
						inst.schema_name_policy_map[sname] = data[oks[z]]['razor_policy'];
						div_html += '<option value="' + sname + '">' + sname + '</option>';
					}
				}

				$('#' + divid ).html( div_html );

			}
		});

	}

	fill_existing_nodes()
	{
		var fdata = {
			RazorToolAPICommand: 'GetAllRazorNodes'
		};

		var pls_wait = '<option value="">Please wait while Razor node data loads...</option>';
		$('#selected-existing-node').html( pls_wait );

		$.ajax({
			url: "/widgets/razor_metadata_tool/php/razor.php",
			type: 'get',
			async: true,
			data: fdata,
			dataType: 'json',
			success: function(data){
				var div_html = '<option value="">Select an Existing Razor Node</option>' + "\n";

				if( data ){
					// console.log("fill_existing_nodes() ajax get reutrned: " + JSON.stringify(data) );
					console.log("fill_existing_nodes() ajax get reutrned: " + data );
					var pdata = data;
					// var pdata = JSON.parse(data);
					var oks = Object.keys( pdata ).sort();

					for( var z = 0; z < oks.length; z++ ){
						div_html += '<option value="' + pdata[oks[z]] + '|' + oks[z] +'">' +
							oks[z] + ' (' + pdata[oks[z]] + ")</option>\n";
					}

				}

				$('#selected-existing-node').html( div_html );

			}
		});
	}

	selected_node_handler()
	{
		var tmpnode = $('#selected-existing-node').val();
		var existing_div = $('#metadata-clear-confirm-form').html();
		var div_html = '', button_text = '', node_fqdn = '', node_hostname = '',
			action_options = '';

		[this.existing_node_name, node_fqdn] = tmpnode.split('|', 2);
		this.razor_node_name = this.existing_node_name;
		this.existing_node_hostname = node_hostname = node_fqdn.split('.')[0];
		this.is_existing_node = true;

		/*
		div_html = '<h4>You have Chosen to Clear the Razor Node Metadata for ' + 
			node_hostname + ".  Click Below to Confirm</h4>\n" + existing_div;
			*/
		div_html = '<h4>Please Choose the Action to Perform on Existing Razor Node ' +
			node_hostname + ' (' + this.existing_node_name + ")</h4>\n" + existing_div;
		action_options = "<option>Select an Action</option>\n" +
			'<option value="reinstall">Mark Node for Reinstallation</option>' + "\n" +
			'<option value="clear">Clear All Node Metadata</option>' + "\n";
		button_text = 'Remove Metadata for ' + node_hostname + ' (' + 
			this.existing_node_name + ')';


		$('#initial-loading').hide();
		$('#system-selection-form').hide();
		$('#host-configuration-form').hide();
		$('#host-submission-form').hide();
		$('#schemadef-buttondiv').hide();
		$('#schema-build-div').hide();
		$('#initial-pageload-div').hide();

		$('#metadata-clear-confirm-form').html( div_html );
		$('#metadata-clear-reinstall-selection').html( action_options );
		// $('#metadata-clear-button').html( button_text );
		$('#metadata-clear-confirm-form').show();
		$('#metadata-clear-button').hide();

	}

	clear_reinstall_select_handler()
	{
		// fill in button text with "pertinent" information, then show it...and?
		var clre = $('#metadata-clear-reinstall-selection').val();
		var button_text = '';
		var show = true;

		if( clre === 'clear' ){
			// $('#metadata-clear-button').click('RTOO.process_metadata_clear_submit();');
			button_text = 'Remove Metadata for ' + this.existing_node_hostname + ' (' +
					this.existing_node_name + ')';
		}
		else if( clre === 'reinstall' ){
			button_text = 'Mark ' + this.existing_node_hostname + ' (' +
					this.existing_node_name + ') for Reinstallation';
		}
		else{
			show = false;
			$('#metadata-clear-button').hide();
		}

		if( show ){
			$('#metadata-clear-button').html( button_text );
			$('#metadata-clear-button').show();
		}

	}

	process_metadata_clear_reinstall_submit()
	{
		var inst = this;
		var hostname = inst.existing_node_hostname;
		var nodename = inst.existing_node_name;
		var clear_data = {
			RazorToolAPICommand: 'ClearNodeMetadata',
			RazorToolAPIRequestData: {
				node: inst.existing_node_name,
				all: true
			}
		};
		var reinstall_data = {
			RazorToolAPICommand: 'ReinstallNode',
			RazorToolAPIRequestData: {
				name: inst.existing_node_name
			}
		};
		var existing_div = $('#metadata-editor-os-select-div').html();
		var div_html = '';
		var user_selection = $('#metadata-clear-reinstall-selection').val();

		console.log("process_metadata_clear_reinstall_submit(): doing " + user_selection + 
				" for node " + reinstall_data.RazorToolAPIRequestData['name'] );

		if( user_selection === 'clear' ){
			var success_function = function( data ){
				console.log("process_metadata_clear_reinstall_submit() ajax reinstall call received " +
				   JSON.stringify( data ) );
				$.ajax({
					url: "/widgets/razor_metadata_tool/php/razor.php",
					type: "post",
					data: clear_data,
					async: false,
					success: function( data ){
						console.log("process_metadata_clear_reinstall_submit() ajax clear call received " +
						   JSON.stringify( data ) );
						div_html += '<h4>Node Metadata Cleared Succesfully.  Choose a Supported ';
						div_html += 'OS Configuration Below for ' + inst.existing_node_hostname;
						div_html += "</h4>\n";

						div_html += existing_div;
						$('#metadata-editor-container-div').show();
						$('#metadata-editor-os-select-div').html( div_html );
						inst.fill_supported_os( 'metadata-edit-select-os' );
						$('#metadata-editor-os-select-div').show();
						$('#metadata-clear-confirm-form').hide();

					}
				});
			};
		}
		else{
			var success_function = function( data ){
				div_html += '<h4>Node ' + hostname + ' (' + nodename +
						") Succesfully Marked for Reinstallation.</h4><p/>\n";
				div_html += 'You may <a href="/app/index">' + 
					"Return to the Application Start Page</a>\n";
				inst.finish_successful_splash_screen( div_html );
			};
		}

		$.ajax({
			url: "/widgets/razor_metadata_tool/php/razor.php",
			type: "post",
			data: reinstall_data,
			async: false,
			success: success_function,
			fail: function( xhr, st, error ){
				console.log("reinstall_node() failed with status " + st + ": " + error);
			}
		});



	}

	metadata_editor_entry_handler()
	{
		this.selected_os = $('#metadata-edit-select-os').val();
		this.lookupHost( this.existing_node_hostname );
	}

}

$(function(){

	RTOO = new RazorMetadataTool();
	mockObj = new MockedSystems();

	$('#submit-button').click(function() {
		this.submit_clicked();
	});

	$('#initial-loading').hide();
	$('#system-selection-form').hide();
	$('#host-configuration-form').hide();
	$('#host-submission-form').hide();
	$('#schemadef-buttondiv').hide();
	$('#schema-build-div').hide();
	$('#metadata-clear-confirm-form').hide();
	$('#metadata-editor-container-div').hide();
	$('#metdata-tool-action-finish-div').hide();

	RTOO.fill_supported_os( 'selected-os' );
	RTOO.fill_existing_nodes();

	$('#initial-pageload-div').show();
	$('#schemadef-button').prop( "disabled", true );

});
