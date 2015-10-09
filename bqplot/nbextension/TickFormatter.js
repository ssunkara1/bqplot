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

 define(["nbextensions/widgets/widgets/js/widget", "./components/d3/d3", "./utils"], function(Widget, d3, bqutils) {
    "use strict";
    return {
        set_tick_values: function() {
            var tick_values = this.model.get_typed_field("tick_values");
            var useticks = [];
            if (tick_values !== undefined && tick_values !== null && tick_values.length > 0) {
                this.axis.tickValues(tick_values);
            } else if (this.num_ticks !== undefined && this.num_ticks !== null) {
                this.axis.tickValues(this.get_ticks());
            } else {
                if (this.axis_scale.model.type === "ordinal") {
                    this.axis.tickValues(this.axis_scale.scale.domain());
                } else if (this.axis_scale.model.type === "log") {
                    var allticks = this.axis_scale.scale.ticks();
                    var oom = Math.abs(Math.log10(this.axis_scale.scale.domain()[1] / this.axis_scale.scale.domain()[0]));
                    if (oom < 2) {
                        this.axis.tickValues(allticks);
                    } else if (oom < 7) {
                        useticks = [];
                        for (var i = 0; i < allticks.length; i++) {
                            var r = Math.abs(Math.log10(allticks[i]) % 1);
                            if ((Math.abs(r) < 0.001) ||
                                (Math.abs(r-1) < 0.001) ||
                                (Math.abs(r-0.30103) < 0.001) ||
                                (Math.abs(r-0.69897) < 0.001)) {
                                useticks.push(allticks[i]);
                            }
                        }
                        this.axis.tickValues(useticks);
                    } else {
                        useticks = [];
                        var s = Math.round(oom / 10);
                        for (var i = 0; i < allticks.length; i++) {
                            var r = Math.abs(Math.log10(allticks[i]) % s);
                            if ((Math.abs(r) < 0.001) || (Math.abs(r-s) < 0.001)) {
                                useticks.push(allticks[i]);
                            }
                        }
                        this.axis.tickValues(useticks);
                    }
                } else {
                    this.axis.tickValues(this.axis_scale.scale.ticks());
                }
            }
            if(this.model.get("tick_format") == null ||
                this.model.get("tick_format") == undefined) {
                    if(this.axis_scale.type !== "ordinal") {
                        // TODO: can be avoided if num_ticks and tickValues are
                        // not mentioned
                        this.tick_format = this.guess_tick_format(this.axis.tickValues());
                    }
            }
            this.axis.tickFormat(this.tick_format);
            if(this.g_axisline) {
                this.g_axisline.call(this.axis);
            }
        },
		generate_tick_formatter: function() {
            if(this.axis_scale.model.type === "date" ||
               this.axis_scale.model.type === "date_color_linear") {
                if(this.model.get("tick_format")) {
                    return d3.time.format(this.model.get("tick_format"));
                } else {
                    return this.guess_tick_format();
                }
            } else if (this.axis_scale.model.type === "ordinal") {
                var tick_format = this.model.get("tick_format");
                if(tick_format) {
                    //TODO: This may not be the best way to do this. We can
                    //check the instance of the elements in the domain and
                    //apply the format depending on that.
                    if(bqutils.is_valid_time_format(tick_format)) {
                        return d3.time.format(tick_format);
                    } else {
                        return d3.format(tick_format);
                    }
                }
                return function(d) { return d; };
            } else {
                // linear or log scale
                if(this.model.get("tick_format")) {
                    return d3.format(this.model.get("tick_format"));
                }
                return this.guess_tick_format();
            }
        },
        get_ticks: function(data_array) {
            // Have to do different things based on the type of the scale.
            // If an array is passed, then just scale and return equally spaced
            // points in the array. This is the way it is done for ordinal
            // scales.
            if(this.axis_scale.model.type === "ordinal") {
                data_array = this.axis_scale.scale.domain();
            }
            if(this.num_ticks < 2)
                return [];
            if(data_array) {
                if(data_array.length <= this.num_ticks) {
                    return data_array;
                } else {
                   var step = Math.floor(data_array.length / (this.num_ticks - 1));
                   var indices = _.range(0, data_array.length, step);
                   return indices.map(function(index) {
                       return data_array[index];
                   });
                }
            }
            var scale_range = this.axis_scale.scale.domain();
            var max_index = (this.axis_scale.scale.domain().length - 1);
            var step = (scale_range[max_index] - scale_range[0]) / (this.num_ticks - 1);
            if(this.axis_scale.model.type === "date" ||
               this.axis_scale.model.type === "date_color_linear") {
            //For date scale, the dates have to be converted into milliseconds
            //since epoch time and then back.
                scale_range[0] = scale_range[0].getTime();
                scale_range[max_index] = scale_range[max_index].getTime();
                var max = (scale_range[max_index] + (step * 0.5));
                var range_in_times = _.range(scale_range[0], max, step);
                return range_in_times.map(function(elem) {
                    return new Date(elem);
                });
            } else {
                var max = (scale_range[max_index] + (step * 0.5));
                return _.range(scale_range[0], max, step);
            }
        },
        _get_digits: function(number) {
            return (number == 0) ? 1 : (Math.floor(Math.log10(Math.abs(number))) + 1);
        },
        _replace_trailing_zeros: function(str) {
            //regex to replace the trailing
            //zeros after the decimal point.
            //Handles the case of exponentially formatted string
            //TODO: Should be done in a single regex
            var e_index = str.search("e");
            if(e_index != -1) {
                return str.substring(0, e_index).replace(/(\.[0-9]*?)0+$/gi, "$1").replace(/\.$/, "") +
                       str.substring(e_index);
            } else {
                return str.replace(/(\.[0-9]*?)0+$/gi, "$1").replace(/\.$/, "");
            }
        },
        get_format_func: function(prec) {
            if(prec === 0) {
            // format this as an integer
                return function(number) { return d3.format("d")(Math.round(number)); }
            }
            //if it is -1, then it is a generic format
            var fmt_string = (prec == -1) ? "" : ("." + (prec));
            var self = this;
            return function(number) {
                var str = d3.format(fmt_string + "g")(number);
                var reg_str = str.replace(/-|\.|e/gi, "");
                if(reg_str.length < 6) {
                    return self._replace_trailing_zeros(str);
                } else {
                    //if length is more than 6, format it exponentially
                    if(fmt_string === "") {
                        //if fmt_string is "", then the number o/p can be
                        //arbitrarily large
                        var new_str = d3.format(fmt_string + "e")(number);
                        if(new_str.length >= 7) {
                            //in the case of a round off error, setting the max
                            //limit to be 6
                             new_str = d3.format(".6e")(number);
                        }
                        return self._replace_trailing_zeros(new_str);
                    } else {
                        //Format with the precision required
                        return self._replace_trailing_zeros(d3.format(fmt_string + "e")(number));
                    }
                }
            };
        },
        _linear_scale_precision: function(ticks) {
            ticks = (ticks === undefined || ticks === null) ? this.axis_scale.scale.ticks() : ticks;
            var diff = Math.abs(ticks[1] - ticks[0]);
            var max = Math.max(Math.abs(ticks[0]), Math.abs(ticks[ticks.length - 1]));

            var max_digits = this._get_digits(max);
            // number of digits in the max
            var diff_digits = this._get_digits(diff);
            // number of digits in the min

            var precision = Math.abs(max_digits - diff_digits);
            // difference in the number of digits. The number of digits we have
            // to display is the diff above + 1.
            var limit = 6;
            // limit is a choice of the max number of digits that are
            // represented
            if(max_digits >= 0 && diff_digits > 0) {
                if(max_digits <= 6) {
                // format the number as an integer
                    return 0;
                } else  {
                // precision plus 1 is returned here as they are the number of
                // digits to be displayed. Capped at 6
                    return Math.min(precision, 6) + 1;
                }
            }
            else if(diff_digits <= 0) {
                // return math.abs(diff_digits) + max_digits + 1. Capped at 6.
                return Math.min((Math.abs(diff_digits) + max_digits), 6) + 1;
            }
        },
        linear_sc_format: function(ticks) {
            return this.get_format_func(this._linear_scale_precision(ticks));
        },
        date_sc_format: function(ticks) {
            // assumes that scale is a linear date scale
            ticks = (ticks === undefined || ticks === null) ? this.axis_scale.scale.ticks() : ticks;
            // diff is the difference between ticks in milliseconds
            var diff = Math.abs(ticks[1] - ticks[0]);
            var div = 1000;

            if(Math.floor(diff / div) === 0) {
                //diff is less than a second
                return [[".%L", function(d) { return d.getMilliseconds(); }],
                [":%S", function(d) { return d.getSeconds(); }],
                ["%I:%M", function(d) { return true; }]];
            } else if (Math.floor(diff / (div *= 60)) == 0) {
                //diff is less than a minute
                 return [[":%S", function(d) { return d.getSeconds(); }],
                 ["%I:%M", function(d) { return true; }]];
            } else if (Math.floor(diff / (div *= 60)) == 0) {
                // diff is less than an hour
                return [["%I:%M", function(d) { return d.getMinutes(); }],
                ["%I %p", function(d) { return true; }]];
            } else if (Math.floor(diff / (div *= 24)) == 0) {
                //diff is less than a day
                 return [["%I %p", function(d) { return d.getHours(); }],
                 ["%b %d", function(d) { return true; }]];
            } else if (Math.floor(diff / (div *= 27)) == 0) {
                //diff is less than a month
                return [["%b %d", function(d) { return d.getDate() !== 1; }],
                        ["%b %Y", function(d) { return true; }]];
            } else if (Math.floor(diff / (div *= 12)) == 0) {
                //diff is less than a year
                return [["%b %d", function(d) { return d.getDate() !== 1; }],
                        ["%b %Y", function() { return true;}]];
            } else {
                //diff is more than a year
                return  [["%b %d", function(d) { return d.getDate() !== 1; }],
                         ["%b %Y", function(d) { return d.getMonth();}],
                         ["%Y", function() { return true; }]];
            }
        },
        log_sc_format: function(ticks) {
            return this.get_format_func(this._log_sc_precision(ticks));
        },
        _log_sc_precision: function(ticks) {
            ticks = (ticks === undefined || ticks === null) ? this.axis_scale.scale.ticks() : ticks;
            var ratio = Math.abs(Math.log10(ticks[1] / ticks[0]));

            if(ratio >= 0.3010) {
                //format them as they are with the max_length of 6
                return -1;
            } else {
                //return a default of 3 digits of precision
                return 3;
            }
        },
        guess_tick_format: function(ticks) {
            if(this.axis_scale.model.type == "linear") {
                return this.linear_sc_format(ticks);
            } else if (this.axis_scale.model.type == "date" ||
                       this.axis_scale.model.type == "date_color_linear") {
                return d3.time.format.multi(this.date_sc_format(ticks));
            } else if (this.axis_scale.model.type == "log") {
                return this.log_sc_format(ticks);
            }
        },
    };                      
 });