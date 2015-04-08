({
    paths: {
        amplify                 : "lib/amplify.store",
        apertureTooltip         : "lib/aperture-tooltip",
        Cloud5                  : "lib/Cloud5",
        dragscrollable          : "lib/dragscrollable",
        json2                   : "lib/json2",
        OpenAjaxUnmanagedHub    : "lib/OpenAjaxUnmanagedHub",
        "OpenLayers-textures"   : "lib/OpenLayers-textures",
        proj4js                 : "lib/proj4js",
        raphael                 : "lib/raphael",
        underscore              : "lib/underscore"
    },


    baseUrl : "scripts",
    name: "xdataht/%1Main",
    out: "dist/tellfinder-%2.js",
    removeCombined: true,
    findNestedDependencies: true
})