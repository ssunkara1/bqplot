/* Copyright 2015 Bloomberg Finance L.P.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

define(["widgets/js/widget", "./d3"], function(Widget, d3) {
     "use strict";

    var GeoScale = Widget.WidgetView.extend({
        set_projection: function(projection) {
            this.scale = d3.geo.path().projection(projection);
        }
    });

    var Mercator = GeoScale.extend({
        render: function() {
            var projection = d3.geo.mercator().center([0, 60]).scale(190);
            this.set_projection(projection);
        },
    });

    var AlbersUSA = GeoScale.extend({
        render: function() {
            var projection = d3.geo.albersUsa().scale(1200);
            this.set_projection(projection);
        },
    });

    var Gnomonic = GeoScale.extend({
        render: function() {
            var projection = d3.geo.gnomonic()
                .clipAngle(90 - 1e-3)
                .scale(150)
                //.translate([width / 2, height / 2])
                .precision(0.1);
            this.set_projection(projection);
        },
    });

    var Stereographic = GeoScale.extend({
        render: function() {
            var projection = d3.geo.stereographic()
                .scale(245)
                //.translate([width / 2, height / 2])
                .rotate([-20, 0])
                .clipAngle(180 - 1e-4)
                //.clipExtent([[0, 0], [width, height]])
                .precision(0.1);
            this.set_projection(projection);
        },
    });

    return {
        Mercator: Mercator,
        AlbersUSA: AlbersUSA,
        Gnomonic: Gnomonic,
        Stereographic: Stereographic,
    };
});
