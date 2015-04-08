/**
 * Copyright (c) 2013-2015 Uncharted Software Inc.
 * http://uncharted.software/
 *
 * Released under the MIT License.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
 * of the Software, and to permit persons to whom the Software is furnished to do
 * so, subject to the following conditions:

 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.

 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
define(['../util/rest'], function(rest) {

    var places = {};
    var countryCodes = {};
    var provinceCodes = {};
    var initialized = false;

    var initialize = function() {
        places['san diego'] = [32.716208,-117.157137];
        places['north bay'] = [38.439136,-122.714981];
        places['toronto'] = [43.653342,-79.383842];
        places['san francisco'] = [37.774751,-122.419459];
        places['inland empire'] = [34.054935,-117.565491];
        places['sacramento'] = [38.581553,-121.494634];
        places['orange county'] = [33.717486,-117.831558];
        places['stockton-modesto'] = [37.745743,-121.135468];
        places['centralcoast'] = [34.951242,-120.424318];
        places['monterey bay'] = [36.805986,-121.786408];
        places['monterey'] = [36.60037,-121.891991];
        places['fresno'] = [36.744386,-119.77031];
        places['peninsula'] = [37.55982,-122.332871];
        places['south ba'] = [37.339319,-121.894051];
        places['las vegas'] = [36.113749,-115.173382];
        places['east bay'] = [37.807614,-122.273133];
        places['bakersfield'] = [35.373375,-119.016464];
        places['montreal'] = [45.508272,-73.55554];
        places['reno'] = [39.529202,-119.813475];
        places['vancouver'] = [49.261251,-123.114087];
        places['south bay'] = [37.339319,-121.894051];
        places['los angeles'] = [34.051664,-118.246735];

        provinceCodes['ab'] = '01';
        provinceCodes['bc'] = '02';
        provinceCodes['mb'] = '03';
        provinceCodes['nb'] = '04';
        provinceCodes['nl'] = '05';
        provinceCodes['ns'] = '07';
        provinceCodes['on'] = '08';
        provinceCodes['pe'] = '09';
        provinceCodes['qc'] = '10';
        provinceCodes['sk'] = '11';

        provinceCodes['nt'] = '12'
        provinceCodes['yk'] = '13';
        provinceCodes['nu'] = '14';

        countryCodes['jamaica'] = 'jm';
        countryCodes['ireland'] = 'ie';
        countryCodes['romania'] = 'ro';
        countryCodes['morocco'] = 'ma';
        countryCodes['unitedstates'] = 'us';
        countryCodes['usa'] = countryCodes['unitedstates'];
        countryCodes['spain'] = 'es';
        countryCodes['pakistan'] = 'pk';
        countryCodes['colombia'] = 'co';
        countryCodes['venezuela'] = 've';
        countryCodes['indonesia'] = 'id';
        countryCodes['thebahamas'] = 'bs';
        countryCodes['germany'] = 'de';
        countryCodes['portugal'] = 'pt';
        countryCodes['china'] = 'cn';
        countryCodes['southkorea'] = 'kr';
        countryCodes['canada'] = 'ca';
        countryCodes['hongkong'] = 'hk';
        countryCodes['ecuador'] = 'ec';
        countryCodes['mexico'] = 'mx';
        countryCodes['finland'] =  'fi';
        countryCodes['nigeria'] = 'ng';
        countryCodes['malaysia'] = 'my';
        countryCodes['belgium'] = 'be';
        countryCodes['iceland'] = 'is';
        countryCodes['australia'] = 'au';
        countryCodes['bolivia'] = 'bo';
        countryCodes['austria'] = 'at';
        countryCodes['co.wicklo'] = 'ie';
        countryCodes['southafrica'] = 'za';
        countryCodes['u.s.virginislands'] = 'vi';
        countryCodes['peru'] = 'pe';
        countryCodes['costarica'] = 'cr';
        countryCodes['israel'] = 'il';
        countryCodes['singapore'] = 'sg';
        countryCodes['norway'] = 'no';
        countryCodes['argentina'] = 'ar';
        countryCodes['chile'] = 'cl';
        countryCodes['bangladesh'] = 'bd';
        countryCodes['japan'] = 'jp';
        countryCodes['guam'] = 'gu';
        countryCodes['dominicanrepublic'] = 'do';
        countryCodes['westbank.israel'] = 'il';
        countryCodes['guatemala'] = 'gt';
        countryCodes['switzerland'] = 'ch';
        countryCodes['india'] = 'in';
        countryCodes['france'] = 'fr';
        countryCodes['uruguay'] = 'uy';
        countryCodes['italy'] = 'it';
        countryCodes['bulgaria'] = 'bg';
        countryCodes['sweden'] = 'se';
        countryCodes['thenetherlands'] = 'nl';
        countryCodes['hungary'] = 'hu';
        countryCodes['uk'] = 'gb';
        countryCodes['taiwan'] = 'tw';
        countryCodes['greece'] = 'gr';
        countryCodes['nicaragua'] = 'ni';
        countryCodes['luxembourg'] = 'lu';
        countryCodes['poland'] = 'pl';
        countryCodes['panama'] = 'pa';
        countryCodes['brazil'] = 'br';
        countryCodes['puertorico'] = 'pr';
        countryCodes['dubai-unitedarabemirates'] = 'ae';
        countryCodes['russia'] = 'ru';
        countryCodes['czechrepublic'] = 'cz';
        countryCodes['ukraine'] = 'ua';
        countryCodes['newzealand'] = 'nz';
        countryCodes['elsalvador'] = 'sv';
        countryCodes['denmark'] = 'dk';
        countryCodes['turkey'] = 'tr';
    };

    var geocode = function(placeString) {
        return places[placeString.toLowerCase()];
    };

    var getCountryCode = function(countryString) {
        if (countryCodes.hasOwnProperty(countryString)) {
            return countryCodes[countryString];
        } else {
            return '';
        }
    };

    var getProvinceCode = function(provinceString) {
        if (provinceCodes.hasOwnProperty(provinceString)) {
            return provinceCodes[provinceString];
        } else {
            return '';
        }
    };

    var geocode_server = function(baseUrl, placeorPlaces, callback) {
        var request;
        if (_.isArray(placeorPlaces)) {
            request = {
                requests:placeorPlaces
            };
        } else {
            request = {
                requests:[placeorPlaces]
            };
        }
        rest.post(baseUrl + "rest/geocode", request, "Geocode places", callback);
    };

    if (!initialized) {
        initialize();
        initialized = true;
    }

    return {
        geocode:geocode,
        geocode_server:geocode_server,
        getCountryCode:getCountryCode,
        getProvinceCode:getProvinceCode
    }
});
