aperture.config.provide({
	/*
	 * A default log configuration, which simply appends to the console.
	 */
	'aperture.log' : {
		'level' : 'info',
		'appenders' : {
			// Log to the console (if exists)
			'consoleAppender' : {'level': 'info'}
		}
	},

	/*
	 * The endpoint locations for Aperture services accessed through the io interface
	 */
	'aperture.io' : {
		'rpcEndpoint' : '%host%/openads/rpc',
		'restEndpoint' : '%host%/openads/rest'
	},

	/*
	 * A default map configuration for the examples
	 */
	'aperture.map' : {
		'defaultMapConfig' : {

			/*
			 * Map wide options which are required for proper use of
			 * the tile set below.
			 */
			'options' : {
				'projection': 'EPSG:900913',
				'displayProjection': 'EPSG:900913',
				'units': 'm',
				'numZoomLevels': 12,
				'maxExtent': [
					-20037500,
					-20037500,
					20037500,
					20037500
				]
			},

			/* The example maps use a Tile Map Service (TMS), which when
			 * registered with the correct settings here in the client
			 * requires no server side code. Tile images are simply requested
			 * by predictable url paths which resolve to files on the server.
			 */
			'baseLayer' : {

				/*
				 * The example map tile set was produced with TileMill,
				 * a free and highly recommended open source tool for
				 * producing map tiles, provided by MapBox.
				 * http://www.mapbox.com.
				 *
				 * Requires specific map-wide options, see above.
				 */
				'tms' : {
					'name' : 'Base Map',
					'url' : '../map/',
					'options' : {
						'layername': 'world-graphite',
						'osm': 0,
						'type': 'png',
						serverResolutions: [156543.0339,78271.51695,39135.758475,19567.8792375,9783.93961875,4891.96980938,2445.98490469,1222.99245234], // ,611.496226172,305.748113086,152.874056543,76.4370282715,38.2185141357,19.1092570679,9.55462853394,4.77731426697,2.38865713348,1.19432856674,0.597164283371
						resolutions: [156543.0339,78271.51695,39135.758475,19567.8792375,9783.93961875,4891.96980938,2445.98490469,1222.99245234] //,611.496226172,305.748113086,152.874056543,76.4370282715
					}
				}
			}
		}
	},

	/*
	 * An example palette definition.
	 */
	'aperture.palette' : {
		'color' : {
			'bad'  : '#FF3333',
			'good' : '#66CCC9',
			'selected' : '#7777DD',
			'highlighted' : '#FFCC00'
		},

		'colors' : {
			'series.10' : ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf']
		}

	},

	// EXAMPLES.
	'xdataht.config' : {
		'link-stroke' : {
            'min' : 1,
            'max' : 4
        },
        'node-size' : {
            'min' : 3,
            'max' : 15
        },
        'map-node-size' : {
            'min' : 5,
            'max' : 10
        },
        'map-node-opacity' : 0.5,
        'map-node-stroke-width' : 1.5,
        'map-node-stroke-color' : '#000000',
        'enable-zoom-pan' : true,
        'max-graph-nodes' : 450,
		'explorer' : {
			'column_width' : 200,
			'sankey_width' : 200,
			'sankey_animation_time' : 750,
			'sankey_bezier_step' : 0.01,
			'column_padding' : 5,
			'tooltip_warning_branch_count' : 20,
			'dialog_warning_branch_count' : 40
		},
        'word-cloud' : {
            'stop-words' : 'january,february,march,april,may,june,july,august,september,october,november,december,monday,tuesday,wednesday,thursday,friday,saturday,a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z,0,1,2,3,4,5,6,7,8,9,-,--,\'\',we\'ve,we\'ll,we\'re,who\'ll,who\'ve,who\'s,you\'ll,you\'ve,you\'re,i\'ll,i\'ve,i\'m,i\'d,he\'ll,he\'d,he\'s,she\'ll,she\'d,she\'s,it\'ll,it\'d,it\'s,they\'ve,they\'re,they\'ll,didn\'t,don\'t,can\'t,won\'t,isn\'t,wasn\'t,couldn\'t,should\'t,wouldn\'t,ve,ll,re,th,rd,st,doing,allow,examining,using,during,within,across,among,whether,especially,without,actually,another,am,because,cannot,the,of,to,and,a,in,is,it,you,that,he,was,for,on,are,with,as,I,his,they,be,at,one,have,this,from,or,had,by,hot,word,but,what,some,we,yet,can,out,other,were,all,there,when,up,use,your,how,said,an,each,she,which,do,their,time,if,will,shall,way,about,many,then,them,write,would,like,so,these,her,long,make,thing,see,him,two,has,look,more,day,could,go,come,did,no,most,my,over,know,than,call,first,who,may,down,side,been,now,find,any,new,part,take,get,place,made,where,after,back,little,only,came,show,every,good,me,our,under,upon,very,through,just,great,say,low,cause,much,mean,before,move,right,too,same,tell,does,set,three,want,well,also,small,end,put,hand,large,add,here,must,big,high,such,why,ask,men,went,kind,need,try,us,again,near,should,still,between,never,last,let,though,might,saw,left,late,run,don\'t,while,close,few,seem,next,got,always,those,both,often,thus,won\'t,not,into,inside,its,makes,tenth,trying,i,me,my,myself,we,|us,our,ours,ourselves,you,your,yours,yourself,yourselves,he,him,his,himself,she,her,hers,herself,it,its,itself,they,them,their,theirs,themselves,what,which,who,whom,this,that,these,those,am,is,are,was,were,be,been,being,have,has,had,having,do,does,did,doing,will,would,shall,should,can,could,may,might,must,ought,i\'m,you\'re,he\'s,she\'s,it\'s,we\'re,they\'re,i\'ve,you\'ve,we\'ve,they\'ve,i\'d,you\'d,he\'d,she\'d,we\'d,they\'d,i\'ll,you\'ll,he\'ll,she\'ll,we\'ll,they\'ll,isn\'t,aren\'t,wasn\'t,weren\'t,hasn\'t,haven\'t,hadn\'t,doesn\'t,don\'t,didn\'t,won\'t,wouldn\'t,shan\'t,shouldn\'t,can\'t,cannot,couldn\'t,mustn\'t,let\'s,that\'s,who\'s,what\'s,here\'s,there\'s,when\'s,where\'s,why\'s,how\'s,daren\'t,needn\'t,oughtn\'t,mightn\'t,a,an,the,and,but,if,or,because,as,until,while,of,at,by,for,with,about,against,between,into,through,during,before,after,above,below,to,from,up,down,in,out,on,off,over,under,again,further,then,once,here,there,when,where,why,how,all,any,both,each,few,more,most,other,some,such,no,nor,not,only,own,same,so,than,too,very,one,every,least,less,many,now,ever,never,say,says,said,also,get,go,goes,just,made,make,put,see,seen,whether,like,well,back,even,still,way,take,since,another,however,two,three,four,five,first,second,new,old,high,long,|,&nbsp,<,>,/,\,ad,number:,reviews,join,vip,terms,of,use,privacy,myredbook,s.a.,&amp,privacy&copy;2013,&nbsp;&nbsp,&nbsp;&nbsp;reviews,number,&amp;,weve,were,wholl,whove,whos,youll,youve,youre,ill,ive,im,id,hed,hes,shes,itll,itd,theyve,theyre,theyll,didnt,dont,cant,wont,isnt,wasnt,couldnt,shouldnt,wouldnt,hasnt,havent,hadnt,doesnt,hows,theres,whens,wheres,whys,privacy2013,null'
        }
	}
});
