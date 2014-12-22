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

define(["widgets/js/manager", "d3", "./Mark"], function(WidgetManager, d3, mark) {
    var Mark = mark[0];
    var Bars = Mark.extend({
        render: function() {
            this.padding = this.model.get("padding");
            var base_creation_promise = Bars.__super__.render.apply(this);
            this.set_internal_scales();
            var self = this;
            return base_creation_promise.then(function() {
                self.color_scale = self.scales["color"];
                self.create_listeners();
                self.draw();
            }, null);
        },
        set_internal_scales: function() {
            // Two scales to draw the bars.
            this.x = d3.scale.ordinal();
            this.x1 = d3.scale.ordinal();
        },
        set_ranges: function() {
            if(this.x_scale.model.type != "ordinal") {
                this.x_scale.set_range(this.parent.get_padded_xrange(this.x_scale.model));
            } else {
                this.x_scale.set_range(this.parent.get_padded_xrange(this.x_scale.model), this.padding);
            }
            this.y_scale.set_range(this.parent.get_padded_yrange(this.y_scale.model));
            // x_offset is set later by the adjust_offset method
            // This differs because it is not constant for a scale.
            // Changes based on the data.
            this.x_offset = 0;
            this.y_offset = this.y_scale.offset;
            if(this.color_scale) {
                this.color_scale.set_range();
            }
        },
        adjust_offset: function() {
        // If it is a linear scale and you plot ordinal data on it,
        // the value have to be negatively offset by half of the width of the
        // bars. This is because an ordinal scale gives the values
        // corresponding to the start of the bin but linear scale gives the
        // actual value.
            if(this.x_scale.model.type != "ordinal") {
                this.x_offset = -(this.x.rangeBand() / 2).toFixed(2);
            } else {
                this.x_offset = 0;
            }
        },
        create_listeners: function() {
            Bars.__super__.create_listeners.apply(this);
            this.model.on("data_updated", this.draw, this);
            this.model.on("change:colors", this.update_colors, this);
            this.model.on("colors_updated", this.update_colors, this);
            this.model.on_some_change(["stroke", "opacity"], this.update_stroke_and_opacity, this);
        },
        rescale: function() {
            Bars.__super__.rescale.apply(this);
            this.set_ranges();

            this.el.select(".zeroLine")
                .attr("x1",  0)
                .attr("x2", this.width)
                .attr("y1", this.y_scale.scale(0))
                .attr("y2", this.y_scale.scale(0));

            var bar_groups = this.el.selectAll(".bargroup");
            var bars_sel = bar_groups.selectAll(".bar");

            var that = this;
            this.x.rangeRoundBands(this.set_x_range(), this.padding);
            this.adjust_offset();
            this.x1.rangeRoundBands([0, this.x.rangeBand().toFixed(2)]);

             if(this.x_scale.model.type == "ordinal") {
                var x_max = d3.max(this.parent.get_xrange());
                bar_groups.attr("transform", function(d) { return "translate(" + ((that.x_scale.scale(d.key) !== undefined ? that.x_scale.scale(d.key) : x_max) + that.x_offset) + ", 0)";});
             } else {
                bar_groups.attr("transform", function(d) { return "translate(" + (that.x_scale.scale(d.key) + that.x_offset) + ", 0)";});
             }
             if(this.model.get("type") == "stacked") {
                bars_sel.attr("x", 0)
                    .attr("width", this.x.rangeBand().toFixed(2))
                    .attr("y", function(d) {return d3.min([that.y_scale.scale(d.y1)]); })
                    .attr("height", function(d) { return Math.abs(that.y_scale.scale(0) - (that.y_scale.scale(d.val)));})
            } else {
                bars_sel.attr("x", function(datum, index) { return that.x1(index); })
                    .attr("width", this.x1.rangeBand().toFixed(2))
                    .attr("y", function(d) {return d3.min([that.y_scale.scale(d.val), that.y_scale.scale(0)]); })
                    .attr("height", function(d) { return Math.abs(that.y_scale.scale(0) - (that.y_scale.scale(d.val)));})
            }
        },
        draw: function() {
            this.set_ranges();
            var colors = this.model.get("colors");
            var that = this;
            var animate_dur = this.model.get("animate_dur");
            var bar_groups = this.el.selectAll(".bargroup").data(this.model.bar_data, function(d) {return d.key;});

            // this.x is the ordinal scale used to draw the bars. If a linear
            // scale is given, then the ordinal scale is created from the
            // linear scale.
            if(this.x_scale.model.type != "ordinal") {
                var model_domain = this.model.bar_data.map(function(elem) { return elem.key; })
                this.x.domain(model_domain);
            }
            else {
                this.x.domain(this.x_scale.scale.domain());
            }
            this.x.rangeRoundBands(this.set_x_range(), this.padding);
            this.adjust_offset();
            this.x1.rangeRoundBands([0, this.x.rangeBand().toFixed(2)]);

            if(this.model.bar_data.length > 0)
                this.x1.domain(_.range(this.model.bar_data[0].values.length)).rangeRoundBands([0, this.x.rangeBand().toFixed(2)]);
             bar_groups.enter()
                .append("g")
                .attr("class", "bargroup");
             bar_groups.exit().remove();

             if(this.x_scale.model.type == "ordinal") {
                var x_max = d3.max(this.parent.get_xrange());
                bar_groups.attr("transform", function(d) { return "translate(" + ((that.x_scale.scale(d.key) !== undefined ? that.x_scale.scale(d.key) : x_max) + that.x_offset) + ", 0)";});
             } else {
                bar_groups.attr("transform", function(d) { return "translate(" + (that.x_scale.scale(d.key) + that.x_offset) + ", 0)";});

             }

            var bars_sel = bar_groups.selectAll(".bar")
                .data(function(d) { return d.values; })
            bars_sel.enter()
                .append("rect")
                .attr("class", "bar");


            //FIXME: add transitions
            if(this.model.get("type") == "stacked") {
                bars_sel.attr("x", 0)
                    .attr("width", this.x.rangeBand().toFixed(2))
                    .attr("y", function(d) {return d3.min([that.y_scale.scale(d.y1)]); })
                    .attr("height", function(d) { return Math.abs(that.y_scale.scale(0) - (that.y_scale.scale(d.val)));})
            } else {
                bars_sel.attr("x", function(datum, index) { return that.x1(index); })
                    .attr("width", this.x1.rangeBand().toFixed(2))
                    .attr("y", function(d) {return d3.min([that.y_scale.scale(d.val), that.y_scale.scale(0)]); })
                    .attr("height", function(d) { return Math.abs(that.y_scale.scale(0) - (that.y_scale.scale(d.val)));})
            }
            bar_groups.exit().remove();
            this.update_colors();
            this.update_stroke_and_opacity();

            this.el.selectAll(".zeroLine").remove();
            this.el.append("g")
                .append("line")
                .attr("x1",  0)
                .attr("class", "zeroLine")
                .attr("x2", this.width)
                .attr("y1", this.y_scale.scale(0))
                .attr("y2", this.y_scale.scale(0));
        },
        update_stroke_and_opacity: function() {
            var stroke = this.model.get("stroke");
            var opacity = this.model.get("opacity");
            this.el.selectAll(".bar")
                .style("stroke", (stroke == undefined) ? "none" : stroke)
                .style("opacity", opacity);
        },
        update_colors: function() {
            //the following if condition is to handle the case of single
            //dimensional data.
            //if y is 1-d, each bar should be of 1 color.
            //if y is multi-dimensional, the correspoding values should be of
            //the same color.
            var that = this;
            if(this.color_scale) {
                this.color_scale.set_range();
            }
            if(this.model.bar_data.length > 0){
                if(!(this.model.is_y_2d)) {
                    this.el.selectAll(".bar").style("fill", function(d, i) { return (d.color != undefined && that.color_scale != undefined)
                                                                                    ? that.color_scale.scale(d.color) : that.get_colors(i);});
                } else {
                    this.el.selectAll(".bargroup").
                        selectAll(".bar").style("fill", function(d, i) { return (d.color != undefined && that.color_scale != undefined)
                                                                                    ? that.color_scale.scale(d.color) : that.get_colors(i);});
                }
            }
            //legend color update
            if(this.legend_el) {
                this.legend_el.selectAll(".legendrect")
                    .style("fill", function(d, i) { return (d.color != undefined && that.color_scale != undefined)
                                                                                        ? that.color_scale.scale(d.color) : that.get_colors(i);});
                this.legend_el.selectAll(".legendtext")
                    .style("fill", function(d, i) { return (d.color != undefined && that.color_scale != undefined)
                                                                                        ? that.color_scale.scale(d.color) : that.get_colors(i);});
            }
        },
        draw_legend: function(elem, x_disp, y_disp, inter_x_disp, inter_y_disp) {
            if(!(this.model.is_y_2d) && this.model.get("colors").length != 1)
                return [0, 0];

            this.legend_el = elem.selectAll(".legend" + this.uuid)
                .data(this.model.bar_data[0].values);

            var that = this;
            var rect_dim = inter_y_disp * 0.8;
            this.legend_el.enter()
                .append("g")
                .attr("class", "legend" + this.uuid)
                .attr("transform", function(d, i) { return "translate(0, " + (i * inter_y_disp + y_disp)  + ")"; })
                .on("mouseover", $.proxy(this.highlight_axis, this))
                .on("mouseout", $.proxy(this.unhighlight_axis, this))
                .append("rect")
                .classed("legendrect", true)
                .style("fill", function(d,i) { return (d.color != undefined && that.color_scale != undefined)
                                                                                    ? that.color_scale.scale(d.color) : that.get_colors(i);})
                .attr({x: 0, y: 0, width: rect_dim, height: rect_dim});

            this.legend_el.append("text")
                .attr("class","legendtext")
                .attr("x", rect_dim * 1.2)
                .attr("y", rect_dim / 2)
                .attr("dy", "0.35em")
                .text(function(d, i) {return that.model.get("labels")[i]; })
                .style("fill", function(d,i) { return (d.color != undefined && that.color_scale != undefined)
                                                                                    ? that.color_scale.scale(d.color) : that.get_colors(i);});

            var max_length = d3.max(this.model.get("labels"), function(d) { return d.length; });

            this.legend_el.exit().remove();
            return [this.model.bar_data[0].values.length, max_length];
        },
        set_x_range: function() {
            if(this.x_scale.model.type == "ordinal") {
                return this.x_scale.scale.rangeExtent();
            }
            else
                return [this.x_scale.scale(d3.min(this.x.domain())), this.x_scale.scale(d3.max(this.x.domain()))];
        },
        set_data: function(data) {
            var x_data = data['x']
            var y_data = data['y']

            this.model.set("x", x_data);
            this.model.set("y", y_data);

            this.touch();
            this.update_date_and_draw();

        },
        get_data: function(data) {
            var data_x = this.model.get_typed_field("x");
            var data_y = this.model.get_typed_field("y");

            return {'x': data_x, 'y': data_y};
        },
    });
    WidgetManager.WidgetManager.register_widget_view("bqplot.Bars", Bars);
});


