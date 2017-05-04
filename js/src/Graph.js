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

var d3 = require("d3");
var _ = require("underscore");
var utils = require("./utils");
var mark = require("./Mark");
var markers = require("./Markers");
var bqSymbol = markers.symbol;

var min_size = 10;

var Graph = mark.Mark.extend({
    render: function() {
        var base_creation_promise = Graph.__super__.render.apply(this);

        var that = this;
        this.selected_style = this.model.get("selected_style");
        this.unselected_style = this.model.get("unselected_style");
        this.selected_indices = this.model.get("selected");

        this.hovered_style = this.model.get("hovered_style");
        this.unhovered_style = this.model.get("unhovered_style");
        this.hovered_index = !this.model.get("hovered_point") ? null: [this.model.get("hovered_point")];

        this.display_el_classes = ["node"];
        this.event_metadata = {
            "mouse_over": {
                "msg_name": "hover",
                "lookup_data": false,
                "hit_test": true
            },
            "node_clicked": {
                "msg_name": "node_click",
                "lookup_data": false,
                "hit_test": true
            },
            "parent_clicked": {
                "msg_name": "background_click",
                "hit_test": false
            }
        };
        this.displayed.then(function() {
            that.parent.tooltip_div.node().appendChild(that.tooltip_div.node());
            that.create_tooltip();
        });

        this.d3el.attr("class", "network");

        this.arrow = this.parent.svg.append("defs")
            .append("marker")
            .attr("id", "arrow")
            .attr("refX", 0)
            .attr("refY", 3)
            .attr("markerWidth", 10)
            .attr("markerHeight", 10)
            .attr("orient", "auto")
            .append("path")
            .attr("class", "linkarrow")
            .attr("d", "M0,0 L0,6 L9,3 z");

        return base_creation_promise.then(function() {
            that.event_listeners = {};
            that.process_interactions();
            that.create_listeners();
            that.compute_view_padding();
            that.draw();
        });
    },

    set_ranges: function() {
        var x_scale = this.scales.x,
            y_scale = this.scales.y;
        if (x_scale) {
            x_scale.set_range(this.parent.padded_range("x", x_scale.model));
        }
        if (y_scale) {
            y_scale.set_range(this.parent.padded_range("y", y_scale.model));
        }
    },

    set_positional_scales: function() {
        this.x_scale = this.scales.x;
        this.y_scale = this.scales.y;
        this.listenTo(this.x_scale, "domain_changed", function() {
            if (!this.model.dirty) {
                this.update_position(); }
        });
        this.listenTo(this.y_scale, "domain_changed", function() {
            if (!this.model.dirty) {
                this.update_position(); }
        });
    },

    relayout: function() {
        this.set_ranges();
        this.update_position();
    },

    update_position: function() {
        var x_scale = this.scales.x,
            y_scale = this.scales.y;
        var that = this;

        if (x_scale !== undefined) {
            this.model.mark_data.forEach(function(d) {
                d.x_px = x_scale.scale(d.x) + x_scale.offset;
                d.fixed = true;
            });
        }

        if (y_scale !== undefined) {
            this.model.mark_data.forEach(function(d) {
                d.y_px = y_scale.scale(d.y) + y_scale.offset;
            });
        }

        if (this.force_layout) {
            this.force_layout
                .nodes(this.model.mark_data)
                .links(this.model.link_data)
                .start();
        }
    },

    initialize_additional_scales: function() {
        // function to create the additional scales and create the
        // listeners for the additional scales
        var color_scale = this.scales.color;
        // the following handlers are for changes in data that does not
        // impact the position of the nodes
        if (color_scale) {
            this.listenTo(color_scale, "domain_changed", function() {
                this.color_scale_updated();
            });
            color_scale.on("color_scale_range_changed",
                            this.color_scale_updated, this);
        }
    },

    create_listeners: function() {
        Graph.__super__.create_listeners.apply(this);
        this.d3el.on("mouseover", _.bind(function() {
              this.event_dispatcher("mouse_over");
          }, this))
          .on("mousemove", _.bind(function() {
              this.event_dispatcher("mouse_move");
          }, this))
          .on("mouseout", _.bind(function() {
              this.event_dispatcher("mouse_out");
          }, this));

        this.listenTo(this.model, "data_updated", this.draw, this);
        this.listenTo(this.model, "change:tooltip", this.create_tooltip, this);
        this.listenTo(this.model, "change:enable_hover", function() { this.hide_tooltip(); }, this);
        this.listenTo(this.model, "change:interactions", this.process_interactions);
        this.listenTo(this.model, "change:selected", this.update_selected);
        this.listenTo(this.model, "change:hovered_point", this.update_hovered);
        this.listenTo(this.model, "change:hovered_style", this.hovered_style_updated, this);
        this.listenTo(this.model, "change:unhovered_style", this.unhovered_style_updated, this);
        this.listenTo(this.parent, "bg_clicked", function() {
            this.event_dispatcher("parent_clicked");
        });
    },

    get_node_color: function(data, index) {
        var color_scale = this.scales.color;
        var colors = this.model.get("colors");
        var len = colors.length;
        if(color_scale && data.color !== undefined) {
            return color_scale.scale(data.color);
        }
        return colors[index % len];
    },

    draw: function() {
        this.set_ranges();
        var x_scale = this.scales.x,
            y_scale = this.scales.y,
            color_scale = this.scales.color;

        if (x_scale !== undefined) {
            this.model.mark_data.forEach(function(d) {
                d.x_px = x_scale.scale(d.x) + x_scale.offset;
                d.fixed = true;
            });
        }

        if (y_scale !== undefined) {
            this.model.mark_data.forEach(function(d) {
                d.y_px = y_scale.scale(d.y) + y_scale.offset;
            });
        }

        // clean up the old graph
        this.d3el.selectAll(".node").remove();
        this.d3el.selectAll(".link").remove();

        this.force_layout = d3.layout.force()
            .nodes(this.model.mark_data)
            .links(this.model.link_data)
            .size([this.parent.width, this.parent.height])
            .linkDistance(this.model.get("link_distance"))
            .charge(-300)
            .on("tick", _.bind(this.tick, this))
            .start();

        var directed = this.model.get("directed");

        this.links = this.d3el.selectAll(".link")
            .data(this.force_layout.links())
            .enter().append("path")
            .attr("class", "link")
            .attr("marker-mid", function(d) {
                return directed ? "url(#arrow)" : null;
            });

        var that = this;
        this.nodes = this.d3el.selectAll(".node")
            .data(this.force_layout.nodes())
            .enter().append("g")
            .attr("class", "node");

        this.nodes.append("circle")
            .attr("r", 20)
            .style("fill", function(d, i) { return that.get_node_color(d, i); })
            .call(this.force_layout.drag);

        display_labels = this.model.get("display_labels");
        this.node_labels = this.nodes
            .append("text")
            .attr("text-anchor", "middle")
            .attr("display", display_labels ? "inline": "none")
            .text(function(d) { return d.name; });

        this.nodes.on("click", _.bind(function(d, i) {
            this.event_dispatcher("node_clicked",
                  {"data": d, "index": i});
        }, this));
        this.nodes.on("mouseover", _.bind(function(d, i) {
            this.hover_handler({"data": d, "index": i});
        }, this));
        this.nodes.on("mouseout", _.bind(function() {
            this.reset_hover();
        }, this));
    },

    color_scale_updated: function() {
        var that = this;
        this.nodes.style("fill", function(d, i) {
            return that.get_node_color(d, i);
        });
    },

    process_interactions: function() {
        var interactions = this.model.get("interactions");
        if(_.isEmpty(interactions)) {
            //set all the event listeners to blank functions
            this.reset_interactions();
        } else {
            if(interactions.click !== undefined &&
               interactions.click !== null) {
                if(interactions.click === "tooltip") {
                    this.event_listeners.node_clicked = function() {
                        return this.refresh_tooltip(true);
                    };
                    this.event_listeners.parent_clicked = this.hide_tooltip;
                } else if (interactions.click == "select") {
                    this.event_listeners.parent_clicked = this.reset_selection;
                    this.event_listeners.node_clicked = this.click_handler;
                }
            } else {
                this.reset_click();
            }
            if(interactions.hover !== undefined &&
              interactions.hover !== null) {
                if(interactions.hover === "tooltip") {
                    this.event_listeners.mouse_over = this.refresh_tooltip;
                    this.event_listeners.mouse_move = this.show_tooltip;
                    this.event_listeners.mouse_out = this.hide_tooltip;
                }
            } else {
                this.reset_hover();
            }
        }
    },

    reset_hover: function() {
        this.model.set("hovered_point", null);
        this.hovered_index = null;
        this.touch();
    },

    hover_handler: function(args) {
        var data = args.data;
        var index = args.index;
        this.model.set("hovered_point",
                       index, {updated_view: this});
        this.touch();
    },

    reset_selection: function() {
        this.model.set("selected", null);
        this.selected_indices = null;
        this.touch();
    },

    click_handler: function(args) {
        var data = args.data;
        var index = args.index;
        var that = this;
        var idx = this.model.get("selected");
        var selected = idx ? utils.deepCopy(idx) : [];
        // index of bar i. Checking if it is already present in the list.
        var elem_index = selected.indexOf(index);
        // Replacement for "Accel" modifier.
        var accelKey = d3.event.ctrlKey || d3.event.metaKey;

        if(elem_index > -1 && accelKey) {
            // if the index is already selected and if accel key is
            // pressed, remove the node from the list
            selected.splice(elem_index, 1);
        } else {
            if(accelKey) {
                //If accel is pressed and the bar is not already selcted
                //add the bar to the list of selected bars.
                selected.push(index);
            }
            // updating the array containing the bar indexes selected
            // and updating the style
            else {
                //if accel is not pressed, then clear the selected ones
                //and set the current node to the selected
                selected = [];
                selected.push(index);
            }
        }
        this.model.set("selected",
                       ((selected.length === 0) ? null : selected),
                       {updated_view: this});
        this.touch();
        if(!d3.event) {
            d3.event = window.event;
        }
        var e = d3.event;
        if(e.cancelBubble !== undefined) { // IE
            e.cancelBubble = true;
        }
        if(e.stopPropagation) {
            e.stopPropagation();
        }
        e.preventDefault();
    },

    // Hovered Style related functions
    hovered_style_updated: function(model, style) {
        this.hovered_style = style;
        this.clear_style(model.previous("hovered_style"), this.hovered_index);
        this.style_updated(style, this.hovered_index);
    },

    unhovered_style_updated: function(model, style) {
        this.unhovered_style = style;
        var hov_indices = this.hovered_index;
        var unhovered_indices = (hov_indices) ?
            _.range(this.model.mark_data.length).filter(function(index){
                return hov_indices.indexOf(index) === -1;
            }) : [];
        this.clear_style(model.previous("unhovered_style"), unhovered_indices);
        this.style_updated(style, unhovered_indices);
    },

    update_selected: function(model, value) {
        this.selected_indices = value;
        this.apply_styles();
    },

    update_hovered: function(model, value) {
        this.hovered_index = value === null ? value : [value];
        this.apply_styles();
    },

    apply_styles: function(style_arr) {
        if(style_arr === undefined || style_arr == null) {
            style_arr = [this.selected_style, this.unselected_style,
                         this.hovered_style, this.unhovered_style];
        }
        Graph.__super__.apply_styles.apply(this, [style_arr]);

        var all_indices = _.range(this.model.mark_data.length);

        this.set_style_on_elements(this.hovered_style, this.hovered_index);
        var unhovered_indices = (!this.hovered_index) ?
            [] : _.difference(all_indices, this.hovered_index);
        this.set_style_on_elements(this.unhovered_style, unhovered_indices);
    },

    clear_style: function(style_dict, indices) {
        // Function to clear the style of a dict on some or all the nodes of the
        // chart.If indices is null, clears the style on all nodes. If
        // not, clears on only the nodes whose indices are mathcing.
        //
        // This function is not used right now. But it can be used if we
        // decide to accomodate more properties than those set by default.
        // Because those have to cleared specifically.
        var nodes = this.d3el.selectAll(".node");
        if(indices) {
            nodes = nodes.filter(function(d, index) {
                return indices.indexOf(index) !== -1;
            });
        }
        var clearing_style = {};
        for(var key in style_dict) {
            clearing_style[key] = null;
        }
        nodes.style(clearing_style);
    },

    set_style_on_elements: function(style, indices) {
        // If the index array is undefined or of length=0, exit the
        // function without doing anything
        if(!indices || indices.length === 0) {
            return;
        }
        // Also, return if the style object itself is blank
        if(style !== undefined && Object.keys(style).length === 0) {
            return;
        }
        var nodes = this.d3el.selectAll(".node");
        nodes = nodes.filter(function(data, index) {
            return indices.indexOf(index) !== -1;
        });
        nodes.style(style);
    },

    compute_view_padding: function() {
        //This function computes the padding along the x and y directions.
        //The value is in pixels.
        var x_padding = 1.0;

        if(x_padding !== this.x_padding || x_padding !== this.y_padding) {
            this.x_padding = x_padding;
            this.y_padding = x_padding;
            this.trigger("mark_padding_updated");
        }
    },

    selected_deleter: function() {
        d3.event.stopPropagation();
        return;
    },

    update_link_distance: function() {
        var link_dist = this.model.get("link_distance");
        this.force_layout.linkDistance(link_dist).start();
    },

    link_arc: function(d) {
        var dx = d.target.x_px - d.source.x_px,
            dy = d.target.y_px - d.source.y_px,
            dr = Math.sqrt(dx * dx + dy * dy);
        return "M" + d.source.x_px + "," + d.source.y_px + "A" + dr + "," + dr +
               " 0 0,1 " + d.target.x_px + "," + d.target.y_px;
    },

    link_line: function(d) {
        var midx = (d.source.x_px + d.target.x_px) / 2,
            midy = (d.source.y_px + d.target.y_px) / 2;
        return "M" + d.source.x_px + "," + d.source.y_px + "L" + midx + "," +
               midy + "L" +  d.target.x_px + "," + d.target.y_px;
    },

    link_slant_line: function(d) {
        var midx = (d.source.x_px + d.target.x_px) / 2;
        return "M" + d.source.x_px + "," + d.source.y_px +
               "L" +  midx + "," + d.target.y_px +
               "L" +  d.target.x_px + "," + d.target.y_px;
    },

    tick: function() {
        var link_type = this.model.get("link_type");

        this.nodes.attr("transform", transform);

        var link_path_func = this.link_arc;
        switch(link_type) {
            case 'arc':
                link_path_func = this.link_arc;
                break;
            case 'line':
                link_path_func = this.link_line;
                break;
            case 'slant-line':
                link_path_func = this.link_slant_line;
                break;
            default:
                link_path_func = this.link_arc;
        }

        this.links.attr("d", function(d) { return link_path_func(d); });

        function transform(d) {
            return "translate(" + d.x_px + "," + d.y_px + ")";
        }
    },
});

module.exports = {
    Graph: Graph
};
