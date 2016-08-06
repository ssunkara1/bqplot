# Copyright 2015 Bloomberg Finance L.P.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

r"""

=====
Marks
=====

.. currentmodule:: bqplot.marks

.. autosummary::
   :toctree: _generate/

   Mark
   Lines
   FlexLine
   Scatter
   Hist
   Bars
   Label
   OHLC
   Pie
   Map
"""
from ipywidgets import Widget, DOMWidget, CallbackDispatcher, Color, widget_serialization
from traitlets import (
        Int, Unicode, List, Enum, Dict, Bool, Float, TraitError, Instance, Tuple
    )

from .scales import Scale, OrdinalScale
from .traits import NdArray, Date

from .colorschemes import CATEGORY10


def register_mark(key=None):
    """Returns a decorator registering a mark class in the mark type registry.

    If no key is provided, the class name is used as a key. A key is provided
    for each core bqplot mark so that the frontend can use
    this key regardless of the kernel language.
    """
    def wrap(mark):
        l = key if key is not None else mark.__module__ + mark.__name__
        Mark.mark_types[l] = mark
        return mark
    return wrap


class Mark(Widget):

    """The base mark class.

    Traitlet mark attributes may be decorated with metadata.

    **Data Attribute Decoration**

    Data attributes are decorated with the following values:

    scaled: bool
        Indicates whether the considered attribute is a data attribute which
        must be associated with a scale in order to be taken into account.
    rtype: string
        Range type of the associated scale.
    atype: string
        Key in bqplot's axis registry of the recommended axis type to represent
        this scale. When not specified, the default is 'bqplot.Axis'.

    Attributes
    ----------
    display_name: string
        Holds a user-friendly name for the trait attribute.
    mark_types: dict (class-level attribute)
        A registry of existing mark types.
    scales: Dict of scales (default: {})
        A dictionary of scales holding scales for each data attribute.
        - If a mark holds a scaled attribute named 'x', the scales dictionary
        must have a corresponding scale for the key 'x'.
        - The scale's range type should be equal to the scaled attribute's
        range type (rtype).
    scales_metadata: Dict (default: {})
        A dictionary of dictionaries holding metadata on the way scales are
        used by the mark. For example, a linear scale may be used to count
        pixels horizontally or vertically. The content of this dictionnary
        may change dynamically. It is an instance-level attribute.
    preserve_domain: dict (default: {})
        Indicates if this mark affects the domain(s) of the specified scale(s).
        The keys of this dictionary are the same as the ones of the "scales"
        attribute, and values are boolean. If a key is missing, it is
        considered as False.
    display_legend: bool (default: False)
        Display toggle for the mark legend in the general figure legend
    labels: list of unicode strings (default: [])
        Labels of the items of the mark. This attribute has different meanings
        depending on the type of mark.
    apply_clip: bool (default: True)
        Indicates whether the items that are beyond the limits of the chart
        should be clipped.
    visible: bool (default: True)
        Visibility toggle for the mark.
    selected_style: dict (default: {})
        CSS style to be applied to selected items in the mark.
    unselected_style: dict (default: {})
        CSS style to be applied to items that are not selected in the mark,
        when a selection exists.
    selected: list of integers or None (default: None)
        Indices of the selected items in the mark.
    tooltip: DOMWidget or None (default: None)
        Widget to be displayed as tooltip when elements of the scatter are
        hovered on
    tooltip_style: Dictionary (default: {'opacity': 0.9})
        Styles to be applied to the tooltip widget
    enable_hover: Bool (default: True)
        Boolean attribute to control the hover interaction for the scatter. If
        this is false, the on_hover custom mssg is not sent back to the python
        side
    interactions: Dictionary (default: {'hover': 'tooltip'})
        Dictionary listing the different interactions for each mark. The key is
        the event which triggers the interaction and the value is the kind of
        interactions. Keys and values can only take strings from separate enums
        for each mark.
    tooltip_location : {'mouse', 'center'} (default: 'mouse')
        Enum specifying the location of the tooltip. 'mouse' places the tooltip
        at the location of the mouse when the tooltip is activated and 'center'
        places the tooltip at the center of the figure. If tooltip is linked to
        a click event, 'mouse' places the tooltip at the location of the click
        that triggered the tooltip to be visible.
    """
    mark_types = {}
    scales = Dict(trait=Instance(Scale)).tag(sync=True, **widget_serialization)
    scales_metadata = Dict().tag(sync=True)
    preserve_domain = Dict().tag(sync=True)
    display_legend = Bool().tag(sync=True, display_name='Display legend')
    labels = List(trait=Unicode()).tag(sync=True, display_name='Labels')
    apply_clip = Bool(True).tag(sync=True)
    visible = Bool(True).tag(sync=True)
    selected_style = Dict().tag(sync=True)
    unselected_style = Dict().tag(sync=True)
    selected = List(None, allow_none=True).tag(sync=True)

    enable_hover = Bool(True).tag(sync=True)
    tooltip = Instance(DOMWidget, allow_none=True, default_value=None).tag(sync=True, **widget_serialization)
    tooltip_style = Dict({'opacity': 0.9}).tag(sync=True)
    interactions = Dict({'hover': 'tooltip'}).tag(sync=True)
    tooltip_location = Enum(['mouse', 'center'], default_value='mouse').tag(sync=True)

    _model_name = Unicode('MarkModel').tag(sync=True)
    _model_module = Unicode('bqplot').tag(sync=True)
    _view_module = Unicode('bqplot').tag(sync=True)
    _ipython_display_ = None

    def _get_dimension_scales(self, dimension, preserve_domain=False):
        """
        Return the list of scales corresponding to a given dimension.

        The preserve_domain optional argument specifies whether one should
        filter out the scales for which preserve_domain is set to True.
        """
        if preserve_domain:
            return [
                self.scales[k] for k in self.scales if (
                    k in self.scales_metadata
                    and self.scales_metadata[k].get('dimension') == dimension
                    and not self.preserve_domain.get(k)
                )
            ]
        else:
            return [
                self.scales[k] for k in self.scales if (
                    k in self.scales_metadata
                    and self.scales_metadata[k].get('dimension') == dimension
                )
            ]

    def _scales_validate(self, scales, scales_trait):
        """
        Validates the `scales` based on the mark's scaled attributes metadata.

        First checks for missing scale and then for 'rtype' compatibility.
        """
        # Validate scales' 'rtype' versus data attribute 'rtype' decoration
        # At this stage it is already validated that all values in self.scales
        # are instances of Scale.
        for name in self.trait_names(scaled=True):
            trait = self.traits()[name]
            if name not in scales:
                # Check for missing scale
                if not trait.allow_none:
                    raise TraitError("Missing scale for data attribute %s." %
                                     name)
            else:
                # Check scale range type compatibility
                if scales[name].rtype != trait.get_metadata('rtype'):
                    raise TraitError("Range type mismatch for scale %s." %
                                     name)
        return scales

    def _selected_default(self):
        return None

    def __init__(self, **kwargs):
        super(Mark, self).__init__(**kwargs)
        self._hover_handlers = CallbackDispatcher()
        self._click_handlers = CallbackDispatcher()
        self._legend_click_handlers = CallbackDispatcher()
        self._legend_hover_handlers = CallbackDispatcher()
        self._element_click_handlers = CallbackDispatcher()
        self._bg_click_handlers = CallbackDispatcher()
        self.on_msg(self._handle_custom_msgs)

    def on_hover(self, callback, remove=False):
        self._hover_handlers.register_callback(callback, remove=remove)

    def on_click(self, callback, remove=False):
        self._click_handlers.register_callback(callback, remove=remove)

    def on_legend_click(self, callback, remove=False):
        self._legend_click_handlers.register_callback(callback, remove=remove)

    def on_legend_hover(self, callback, remove=False):
        self._legend_hover_handlers.register_callback(callback, remove=remove)

    def on_element_click(self, callback, remove=False):
        self._element_click_handlers.register_callback(callback, remove=remove)

    def on_background_click(self, callback, remove=False):
        self._bg_click_handlers.register_callback(callback, remove=remove)

    def _handle_custom_msgs(self, _, content, buffers=None):
        if content.get('event', '') == 'hover':
            self._hover_handlers(self, content)
        if content.get('event', '') == 'click':
            self._click_handlers(self, content)
        elif content.get('event', '') == 'legend_click':
            self._legend_click_handlers(self, content)
        elif content.get('event', '') == 'legend_hover':
            self._legend_hover_handlers(self, content)
        elif content.get('event', '') == 'element_click':
            self._element_click_handlers(self, content)
        elif content.get('event', '') == 'background_click':
            self._bg_click_handlers(self, content)


@register_mark('bqplot.Lines')
class Lines(Mark):

    """Lines mark.

    In the case of the Lines mark, scales for 'x' and 'y' MUST be provided.

    Attributes
    ----------
    icon: string (class-level attribute)
        Font-awesome icon for the respective mark
    name: string (class-level attribute)
        User-friendly name of the mark
    colors: list of colors (default: CATEGORY10)
        List of colors of the Lines. If the list is shorter than the number
        of lines, the colors are reused.
    close_path: bool (default: False)
        Whether to close the paths or not.
    fill: {'none', 'bottom', 'top', 'inside'}
        Fill in the area defined by the curves
    fill_colors: list of colors (default: [])
        Fill colors for the areas. Defaults to stroke-colors when no color provided.
    opacities: list of floats (default: [])
        Opacity for the  lines and patches. Defaults to 1 when the list is too
        short, or the element of the list is set to None.
    fill_opacities: list of floats (default: [])
        Opacity for the areas. Defaults to 1 when the list is too
        short, or the element of the list is set to None.
    stroke_width: float (default: 2)
        Stroke width of the Lines
    labels_visibility: {'none', 'label'}
        Visibility of the curve labels
    curves_subset: list of integers or None (default: [])
        If set to None, all the lines are displayed. Otherwise, only the items
        in the list will have full opacity, while others will be faded.
    line_style: {'solid', 'dashed', 'dotted', 'dash_dotted'}
        Line style.
    interpolation: {'linear', 'basis', 'cardinal', 'monotone'}
        Interpolation scheme used for interpolation between the data points
        provided. Please refer to the svg interpolate documentation for details
        about the different interpolation schemes.
    marker: {'circle', 'cross', 'diamond', 'square', 'triangle-down',
             'triangle-up', 'arrow', 'rectangle', 'ellipse'}
        Marker shape
    marker_size: nonnegative int (default: 64)
        Default marker size in pixels

    Data Attributes

    x: numpy.ndarray (default: [])
        abscissas of the data points (1d or 2d array)
    y: numpy.ndarray (default: [])
        ordinates of the data points (1d or 2d array)
    color: numpy.ndarray (default: [])
        colors of the different lines based on data. If it is [], then the
        colors from the colors attribute are used. Each line has a single color
        and if the size of colors is less than the number of lines, the
        remaining lines are given the default colors.

    Notes
    -----
    The fields which can be passed to the default tooltip are:
        name: label of the line
        index: index of the line being hovered on
        color: data attribute for the color of the line
    The following are the events which can trigger interactions:
        click: left click of the mouse
        hover: mouse-over an element
    The following are the interactions which can be linked to the above events:
        tooltip: display tooltip
    """
    # Mark decoration
    icon = 'fa-line-chart'
    name = 'Lines'

    # Scaled attributes
    x = NdArray().tag(sync=True, min_dim=1, max_dim=2,
                scaled=True, rtype='Number', atype='bqplot.Axis')
    y = NdArray().tag(sync=True, min_dim=1, max_dim=2,
                scaled=True, rtype='Number', atype='bqplot.Axis')
    color = NdArray(None, allow_none=True).tag(sync=True, scaled=True,
                    rtype='Color', atype='bqplot.ColorAxis', min_dim=1, max_dim=1)

    # Other attributes
    scales_metadata = Dict({
        'x': {'orientation': 'horizontal', 'dimension': 'x'},
        'y': {'orientation': 'vertical', 'dimension': 'y'},
        'color': {'dimension': 'color'}
    }).tag(sync=True)
    colors = List(trait=Color(default_value=None, allow_none=True),
                  default_value=CATEGORY10).tag(sync=True, display_name='Colors')
    fill_colors = List(trait=Color(default_value=None, allow_none=True),
                       default_value=[]).tag(sync=True, display_name='Fill colors')
    stroke_width = Float(2.0).tag(sync=True, display_name='Stroke width')
    labels_visibility = Enum(['none', 'label'], default_value='none').tag(sync=True, display_name='Labels visibility')
    curves_subset = List().tag(sync=True)
    line_style = Enum(['solid', 'dashed', 'dotted', 'dash_dotted'],
                      default_value='solid').tag(sync=True, display_name='Line style')
    interpolation = Enum(['linear', 'basis', 'cardinal', 'monotone'], default_value='linear').tag(sync=True,
                         display_name='Interpolation')
    close_path = Bool().tag(sync=True, display_name='Close path')
    fill = Enum(['none', 'bottom', 'top', 'inside'], default_value='none').tag(sync=True, display_name='Fill')
    marker = Enum(['circle', 'cross', 'diamond', 'square', 'triangle-down',
                   'triangle-up', 'arrow', 'rectangle', 'ellipse'],
                  default_value=None, allow_none=True).tag(sync=True,
                  display_name='Marker')
    marker_size = Int(64).tag(sync=True, display_name='Default size')

    opacities = List().tag(sync=True, display_name='Opacity')
    fill_opacities = List().tag(sync=True, display_name='Fill Opacity')
    _view_name = Unicode('Lines').tag(sync=True)
    _model_name = Unicode('LinesModel').tag(sync=True)


@register_mark('bqplot.FlexLine')
class FlexLine(Mark):

    """Flexible Lines mark.

    In the case of the FlexLines mark, scales for 'x' and 'y' MUST be provided.
    Scales for the color and width data attributes are optional. In the case
    where another data attribute than 'x' or 'y' is provided but the
    corresponding scale is missing, the data attribute is ignored.

    Attributes
    ----------
    name: string (class-level attributes)
        user-friendly name of the mark
    colors: list of colors (default: CATEGORY10)
        List of colors for the Lines
    stroke_width: float (default: 1.5)
        Default stroke width of the Lines

    Data Attributes

    x: numpy.ndarray (default: [])
        abscissas of the data points (1d array)
    y: numpy.ndarray (default: [])
        ordinates of the data points (1d array)
    color: numpy.ndarray or None (default: [])
        Array controlling the color of the data points
    width: numpy.ndarray or None (default: [])
        Array controlling the widths of the Lines.
    """
    # Mark decoration
    icon = 'fa-line-chart'
    name = 'Flexible lines'

    # Scaled attributes
    x = NdArray().tag(sync=True, min_dim=1, max_dim=1, scaled=True, rtype='Number', atype='bqplot.Axis')
    y = NdArray().tag(sync=True, min_dim=1, max_dim=1, scaled=True, rtype='Number', atype='bqplot.Axis')
    color = NdArray(None, allow_none=True).tag(sync=True, scaled=True, rtype='Color', atype='bqplot.ColorAxis')
    width = NdArray(None, allow_none=True).tag(sync=True, scaled=True, rtype='Number')

    # Other attributes
    scales_metadata = Dict({
        'x': {'orientation': 'horizontal', 'dimension': 'x'},
        'y': {'orientation': 'vertical', 'dimension': 'y'},
        'color': {'dimension': 'color'}
    }).tag(sync=True)
    stroke_width = Float(1.5).tag(sync=True, display_name='Stroke width')
    colors = List(trait=Color(default_value=None, allow_none=True), default_value=CATEGORY10).tag(sync=True)
    _view_name = Unicode('FlexLine').tag(sync=True)
    _model_name = Unicode('FlexLineModel').tag(sync=True)


@register_mark('bqplot.Scatter')
class Scatter(Mark):

    """Scatter mark.

    In the case of the Scatter mark, scales for 'x' and 'y' MUST be provided.
    The scales of other data attributes are optional. In the case where another
    data attribute than 'x' or 'y' is provided but the corresponding scale is
    missing, the data attribute is ignored.

    Attributes
    ----------
    icon: string (class-level attribute)
        Font-awesome icon for that mark
    name: string (class-level attribute)
        User-friendly name of the mark
    marker: {'circle', 'cross', 'diamond', 'square', 'triangle-down', 'triangle-up', 'arrow', 'rectangle', 'ellipse'}
        Marker shape
    default_colors: list of colors (default: ['DeepSkyBlue'])
        List of colors of the markers. If the list is shorter than the number
        of points, the colors are reused.
    stroke: Color or None (default: None)
        Stroke color of the marker
    stroke_width: Float (default: 1.5)
        Stroke width of the marker
    default_opacities: list of floats (default: [1.0])
        Default opacities of the markers. If the list is shorter than the number
        of points, the opacities are reused.
    default_skew: float (default: 0.5)
        Default skew of the marker.
        This number is validated to be between 0 and 1.
    default_size: nonnegative int (default: 64)
        Default marker size in pixel.
        If size data is provided with a scale, default_size stands for the
        maximal marker size (i.e. the maximum value for the 'size' scale range)
    names: numpy.ndarray (default: [])
        Labels for the points of the chart
    display_names: bool (default: True)
        Controls whether names are displayed for points in the scatter

    Data Attributes

    x: numpy.ndarray (default: [])
        abscissas of the data points (1d array)
    y: numpy.ndarray (default: [])
        ordinates of the data points (1d array)
    color: numpy.ndarray or None (default: [])
        color of the data points (1d array). Defaults to default_color when not
        provided or when a value is NaN
    opacity: numpy.ndarray or None (default: [])
        opacity of the data points (1d array). Defaults to default_opacity when
        not provided or when a value is NaN
    size: numpy.ndarray or None (default: [])
        size of the data points. Defaults to default_size when not provided or
        when a value is NaN
    skew: numpy.ndarray or None (default: [])
        skewness of the markers representing the data points. Defaults to
        default_skew when not provided or when a value is NaN
    rotation: numpy.ndarray or None (default: [])
        orientation of the markers representing the data points.
        The rotation scale's range is [0, 180]
        Defaults to 0 when not provided or when a value is NaN.

    Notes
    -----
    The fields which can be passed to the default tooltip are:
        All the data attributes
        index: index of the marker being hovered on
    The following are the events which can trigger interactions:
        click: left click of the mouse
        hover: mouse-over an element
    The following are the interactions which can be linked to the above events:
        tooltip: display tooltip
        add: add new points to the scatter (can only linked to click)
    """
    # Mark decoration
    icon = 'fa-cloud'
    name = 'Scatter'

    # Scaled attribtes
    x = NdArray().tag(sync=True, min_dim=1, max_dim=1, scaled=True,
                rtype='Number', atype='bqplot.Axis')
    y = NdArray().tag(sync=True, min_dim=1, max_dim=1,
                scaled=True, rtype='Number', atype='bqplot.Axis')
    color = NdArray(None, allow_none=True).tag(sync=True, scaled=True,
                    rtype='Color', atype='bqplot.ColorAxis', min_dim=1, max_dim=1)
    opacity = NdArray(None, allow_none=True).tag(sync=True, scaled=True,
                      rtype='Number', min_dim=1, max_dim=1)
    size = NdArray(None, allow_none=True).tag(sync=True, scaled=True,
                   rtype='Number', min_dim=1, max_dim=1)
    skew = NdArray(None, allow_none=True).tag(sync=True, scaled=True, rtype='Number',
                   min_dim=1, max_dim=1)
    rotation = NdArray(None, allow_none=True).tag(sync=True, scaled=True,
                       rtype='Number', min_dim=1, max_dim=1)
    hovered_style = Dict().tag(sync=True)
    unhovered_style = Dict().tag(sync=True)
    hovered_point = Int(None, allow_none=True).tag(sync=True)

    # Other attributes
    scales_metadata = Dict({
        'x': {'orientation': 'horizontal', 'dimension': 'x'},
        'y': {'orientation': 'vertical', 'dimension': 'y'},
        'color': {'dimension': 'color'},
        'size': {'dimension': 'size'},
        'opacity': {'dimension': 'opacity'}
    }).tag(sync=True)
    marker = Enum(['circle', 'cross', 'diamond', 'square', 'triangle-down',
                   'triangle-up', 'arrow', 'rectangle', 'ellipse'],
                  default_value='circle').tag(sync=True, display_name='Marker')
    default_colors = List(trait=Color(default_value=None, allow_none=True),
                          default_value=['DeepSkyBlue']).tag(sync=True,
                          display_name='Colors')
    stroke = Color(None, allow_none=True).tag(sync=True, display_name='Stroke color')
    stroke_width = Float(1.5).tag(sync=True, display_name='Stroke width')
    default_opacities = List(trait=Float(1.0, min=0, max=1, allow_none=True)).tag(sync=True, display_name='Opacities')
    default_skew = Float(0.5, min=0, max=1).tag(sync=True)
    default_size = Int(64).tag(sync=True, display_name='Default size')

    names = NdArray().tag(sync=True)
    display_names = Bool(True).tag(sync=True, display_name='Display names')
    fill = Bool(True).tag(sync=True)
    drag_color = Color(None, allow_none=True).tag(sync=True)
    names_unique = Bool(True).tag(sync=True)

    enable_move = Bool().tag(sync=True)
    enable_delete = Bool().tag(sync=True)
    restrict_x = Bool().tag(sync=True)
    restrict_y = Bool().tag(sync=True)
    update_on_move = Bool().tag(sync=True)

    def __init__(self, **kwargs):
        self._drag_start_handlers = CallbackDispatcher()
        self._drag_handlers = CallbackDispatcher()
        self._drag_end_handlers = CallbackDispatcher()
        super(Scatter, self).__init__(**kwargs)

    def on_drag_start(self, callback, remove=False):
        self._drag_start_handlers.register_callback(callback, remove=remove)

    def on_drag(self, callback, remove=False):
        self._drag_handlers.register_callback(callback, remove=remove)

    def on_drag_end(self, callback, remove=False):
        self._drag_end_handlers.register_callback(callback, remove=remove)

    def _handle_custom_msgs(self, _, content, buffers=None):
        event = content.get('event', '')

        if event == 'drag_start':
            self._drag_start_handlers(self, content)
        elif event == 'drag':
            self._drag_handlers(self, content)
        elif event == 'drag_end':
            self._drag_end_handlers(self, content)

        super(Scatter, self)._handle_custom_msgs(self, content)

    _view_name = Unicode('Scatter').tag(sync=True)
    _model_name = Unicode('ScatterModel').tag(sync=True)


@register_mark('bqplot.Hist')
class Hist(Mark):

    """Histogram mark.

    In the case of the Hist mark, scales for 'sample' and 'count' MUST be
    provided.

    Attributes
    ----------
    icon: string (class-level attribute)
        font-awesome icon for that mark
    name: string (class-level attribute)
        user-friendly name of the mark
    bins: nonnegative int (default: 10)
        number of bins in the histogram
    normalized: bool (default: False)
        Boolean attribute to return normalized values which
        sum to 1 or direct counts for the `count` attribute. The scale of
        `count` attribute is determined by the value of this flag.
    colors: list of colors (default: CATEGORY10)
        List of colors of the Histogram. If the list is shorter than the number
        of bins, the colors are reused.
    stroke: Color or None (default: None)
        Stroke color of the histogram
    opacities: list of floats (default: [])
        Opacity for the bins of the histogram. Defaults to 1 when the list is too
        short, or the element of the list is set to None.
    midpoints: list (default: [])
        midpoints of the bins of the histogram. It is a read-only attribute.

    Data Attributes

    sample: numpy.ndarray
        sample of which the histogram must be computed.
    count: numpy.ndarray (read-only)
        number of sample points per bin. It is a read-only attribute.

    Notes
    -----
    The fields which can be passed to the default tooltip are:
        midpoint: mid-point of the bin related to the rectangle hovered on
        count: number of elements in the bin hovered on
        bin_start: start point of the bin
        bin-end: end point of the bin
        index: index of the bin
    """
    # Mark decoration
    icon = 'fa-signal'
    name = 'Histogram'

    # Scaled attributes
    sample = NdArray().tag(sync=True, min_dim=1, max_dim=1, display_name='Sample',
                           scaled=True, rtype='Number', atype='bqplot.Axis')
    count = NdArray(read_only=True).tag(sync=True, display_name='Count', scaled=True,
                                        rtype='Number', atype='bqplot.Axis')
    normalized = Bool(default_value=False).tag(sync=True)
    # FIXME: Should we allow None for count?
    # count is a read-only attribute that is set when the mark is drawn

    # Other attributes
    scales_metadata = Dict({
        'sample': {'orientation': 'horizontal', 'dimension': 'x'},
        'count': {'orientation': 'vertical', 'dimension': 'y'}
    }).tag(sync=True)

    bins = Int(10).tag(sync=True, display_name='Number of bins')
    midpoints = List(read_only=True).tag(sync=True, display_name='Mid points')
    # midpoints is a read-only attribute that is set when the mark is drawn
    colors = List(trait=Color(default_value=None, allow_none=True),
                  default_value=CATEGORY10).tag(sync=True, display_name='Colors')
    stroke = Color(None, allow_none=True).tag(sync=True)
    opacities = List(trait=Float(1.0, min=0, max=1, allow_none=True)).tag(sync=True, display_name='Opacities')

    _view_name = Unicode('Hist').tag(sync=True)
    _model_name = Unicode('HistModel').tag(sync=True)


@register_mark('bqplot.Boxplot')
class Boxplot(Mark):

    """Boxplot marks.

    Attributes
    ----------
    stroke: Color or None
        stroke color of the marker
    color: Color
        fill color of the box
    opacities: list of floats (default: [])
        Opacities for the markers of the boxplot. Defaults to 1 when the list is
        too short, or the element of the list is set to None.
    outlier-color: color
        color for the outlier

    Data Attributes

    _y_default: numpy.ndarray
        default 2 dimensional value for y
    x: numpy.ndarray
        abscissas of the data points (1d array)
    y: numpy.ndarray
        Sample data points (2d array)
    """

    # Mark decoration
    icon = 'fa-birthday-cake'
    name = 'Boxplot chart'

    # Scaled attributes
    x = NdArray().tag(sync=True, scaled=True, rtype='Number', min_dim=1, max_dim=1, atype='bqplot.Axis')

    # Second dimension must contain OHLC data, otherwise the behavior is
    # undefined.
    y = NdArray().tag(sync=True, scaled=True, rtype='Number', min_dim=1, max_dim=2, atype='bqplot.Axis')

    # Other attributes
    scales_metadata = Dict({
        'x': {'orientation': 'horizontal', 'dimension': 'x'},
        'y': {'orientation': 'vertical', 'dimension': 'y'}
    }).tag(sync=True)

    stroke = Color(None, allow_none=True).tag(sync=True, display_name='Stroke color')
    box_fill_color = Color('dodgerblue', sync=True, display_name='Fill color for the box')
    outlier_fill_color = Color('gray').tag(sync=True, display_name='Outlier fill color')
    opacities = List(trait=Float(1.0, min=0, max=1, allow_none=True)).tag(sync=True, display_name='Opacities')

    _view_name = Unicode('Boxplot').tag(sync=True)
    _model_name = Unicode('BoxplotModel').tag(sync=True)


@register_mark('bqplot.Bars')
class Bars(Mark):

    """Bar mark.

    In the case of the Bars mark, scales for 'x' and 'y'  MUST be provided.
    The scales of other data attributes are optional. In the case where another
    data attribute than 'x' or 'y' is provided but the corresponding scale is
    missing, the data attribute is ignored.

    Attributes
    ----------
    icon: string (class-level attribute)
        font-awesome icon for that mark
    name: string (class-level attribute)
        user-friendly name of the mark
    color_mode: {'auto', 'group', 'element'}
        enum attribute to specify if color should be the same for all bars with
        the same x or for all bars which belong to the same array in Y
        'group' means for every x all bars have same color.
        'element' means for every dimension of y, all bars have same color.
        'auto' picks 'group' and 'element' for 1-d and 2-d values of
        Y respectively.
    type: {'stacked', 'grouped'}
        whether 2-dimensional bar charts should appear grouped or stacked.
    colors: list of colors (default: CATEGORY10)
        list of colors for the bars.
    padding: float (default: 0.05)
        attribute to control the spacing between the bars value is specified
        as a percentage of the width of the bar
    stroke: Color or None (default: None)
        stroke color for the bars
    opacities: list of floats (default: [])
        Opacities for the bars. Defaults to 1 when the list is too
        short, or the element of the list is set to None.
    base: float (default: 0.0)
        reference value from which the bars are drawn. defaults to 0.0
    align: {'center', 'left', 'right'}
        alignment of bars with respect to the tick value

    Data Attributes

    x: numpy.ndarray
        abscissas of the data points (1d array)
    y: numpy.ndarray
        ordinates of the values for the data points
    color: numpy.ndarray
        color of the data points (1d array). Defaults to default_color when not
        provided or when a value is NaN

    Notes
    -----
    The fields which can be passed to the default tooltip are:
        All the data attributes
        index: index of the bar being hovered on
        sub_index: if data is two dimensional, this is the minor index
    """
    # Mark decoration
    icon = 'fa-bar-chart'
    name = 'Bar chart'

    # Scaled attributes
    x = NdArray().tag(sync=True, scaled=True, rtype='Number', min_dim=1, max_dim=1, atype='bqplot.Axis')
    y = NdArray().tag(sync=True, scaled=True, rtype='Number', min_dim=1, max_dim=2, atype='bqplot.Axis')
    color = NdArray(None, allow_none=True).tag(sync=True,
                    scaled=True, rtype='Color', atype='bqplot.ColorAxis',
                    min_dim=1, max_dim=1)

    # Other attributes
    scales_metadata = Dict({
        'x': {'orientation': 'horizontal', 'dimension': 'x'},
        'y': {'orientation': 'vertical', 'dimension': 'y'},
        'color': {'dimension': 'color'}
    }).tag(sync=True)
    color_mode = Enum(['auto', 'group', 'element'], default_value='auto').tag(sync=True)
    type = Enum(['stacked', 'grouped'], default_value='stacked').tag(sync=True,
                display_name='Type')
    colors = List(trait=Color(default_value=None, allow_none=True), default_value=CATEGORY10).tag(sync=True, display_name='Colors')
    padding = Float(0.05).tag(sync=True)
    stroke = Color(None, allow_none=True).tag(sync=True)
    base = Float().tag(sync=True)
    opacities = List(trait=Float(1.0, min=0, max=1, allow_none=True)).tag(sync=True, display_name='Opacities')
    align = Enum(['center', 'left', 'right'], default_value='center').tag(sync=True)

    _view_name = Unicode('Bars').tag(sync=True)
    _model_name = Unicode('BarsModel').tag(sync=True)


@register_mark('bqplot.Label')
class Label(Mark):

    """Label mark.

    Attributes
    ----------
    x: Date or float
        horizontal position of the label, in data coordinates or in figure
        coordinates
    y: float or None (default: None)
        vertical y position of the label, in data coordinates or in figure
        coordinates
    x_offset: int (default: 0)
        horizontal offset in pixels from the stated x location
    y_offset: int (default: 0)
        vertical offset in pixels from the stated y location
    color: Color or None (default: None)
        label color
    rotate_angle: float (default: 0.0)
        angle by which the text is to be rotated
    text: string (default: '')
        text to be displayed
    font_size: string (default: '14px')
        font size in px, em or ex
    font_weight: {'bold', 'normal', 'bolder'}
        font weight of the caption
    align: {'start', 'middle', 'end'}
        alignment of the text with respect to the provided location
    enable_move: Bool
        Enable the label to be moved by dragging
    """
    x = NdArray().tag(sync=True, min_dim=1, max_dim=1, atype='bqplot.Axis')
    y = NdArray().tag(sync=True, min_dim=1, max_dim=1, atype='bqplot.Axis')
    color = NdArray(None, allow_none=True).tag(sync=True, scaled=True,
                rtype='Color', atype='bqplot.ColorAxis', min_dim=1, max_dim=1)
    size = NdArray(None, allow_none=True).tag(sync=True, scaled=True,
                   rtype='Number', min_dim=1, max_dim=1)
    rotation = NdArray(None, allow_none=True).tag(sync=True, scaled=True,
                       rtype='Number', min_dim=1, max_dim=1)
    opacity = NdArray(None, allow_none=True).tag(sync=True, scaled=True,
                      rtype='Number', min_dim=1, max_dim=1)
    x_offset = Int().tag(sync=True)
    y_offset = Int().tag(sync=True)
    scales_metadata = Dict({
        'x': { 'orientation': 'horizontal', 'dimension': 'x' },
        'y': { 'orientation': 'vertical', 'dimension': 'y' },
        'color': { 'dimension': 'color' }
    }).tag(sync=True)
    colors = List(trait=Color(default_value=None, allow_none=True), default_value=CATEGORY10).tag(sync=True, display_name='Colors')
    default_opacities = List(trait=Float(1.0, min=0, max=1, allow_none=True)).tag(sync=True, display_name='Opacities')
    rotate_angle = Float().tag(sync=True)
    text = NdArray().tag(sync=True)
    font_size = Float(16.).tag(sync=True)
    font_unit = Enum(['px', 'em', 'pt', '%'], default_value='px').tag(sync=True)
    font_weight = Enum(['bold', 'normal', 'bolder'], default_value='bold').tag(sync=True)
    align = Enum(['start', 'middle', 'end'], default_value='start').tag(sync=True)

    enable_move = Bool().tag(sync=True)
    restrict_x = Bool().tag(sync=True)
    restrict_y = Bool().tag(sync=True)
    update_on_move = Bool().tag(sync=True)

    def __init__(self, **kwargs):
        self._drag_start_handlers = CallbackDispatcher()
        self._drag_handlers = CallbackDispatcher()
        self._drag_end_handlers = CallbackDispatcher()
        super(Label, self).__init__(**kwargs)

    def on_drag_start(self, callback, remove=False):
        self._drag_start_handlers.register_callback(callback, remove=remove)

    def on_drag(self, callback, remove=False):
        self._drag_handlers.register_callback(callback, remove=remove)

    def on_drag_end(self, callback, remove=False):
        self._drag_end_handlers.register_callback(callback, remove=remove)

    def _handle_custom_msgs(self, _, content, buffers=None):
        event = content.get('event', '')

        if event == 'drag_start':
            self._drag_start_handlers(self, content)
        elif event == 'drag':
            self._drag_handlers(self, content)
        elif event == 'drag_end':
            self._drag_end_handlers(self, content)

        super(Label, self)._handle_custom_msgs(self, content)

    _view_name = Unicode('Label').tag(sync=True)
    _model_name = Unicode('LabelModel').tag(sync=True)


@register_mark('bqplot.OHLC')
class OHLC(Mark):

    """Open/High/Low/Close marks.

    Attributes
    ----------
    icon: string (class-level attribute)
        font-awesome icon for that mark
    name: string (class-level attribute)
        user-friendly name of the mark
    marker: {'candle', 'bar'}
        marker type
    stroke: color (default: None)
        stroke color of the marker
    stroke_width: float (default: 1.0)
        stroke width of the marker
    colors: List of colors (default: ['limegreen', 'red'])
        fill colors for the markers (up/down)
    opacities: list of floats (default: [])
        Opacities for the markers of the OHLC mark. Defaults to 1 when the list is too
        short, or the element of the list is set to None.
    format: string (default: 'ohlc')
        description of y data being passed
        supports all permutations of the strings 'ohlc', 'oc', and 'hl'

    Data Attributes

    _y_default: numpy.ndarray
        default 2 dimensional value for y
    x: numpy.ndarray
        abscissas of the data points (1d array)
    y: numpy.ndarray
        Open/High/Low/Close ordinates of the data points (2d array)

    Notes
    -----
    The fields which can be passed to the default tooltip are:
        x: the x value associated with the bar/candle
        open: open value for the bar/candle
        high: high value for the bar/candle
        low: low value for the bar/candle
        close: close value for the bar/candle
        index: index of the bar/candle being hovered on
    """

    # Mark decoration
    icon = 'fa-birthday-cake'
    name = 'OHLC chart'

    # Scaled attributes
    x = NdArray().tag(sync=True, scaled=True,
                rtype='Number', min_dim=1, max_dim=1, atype='bqplot.Axis')
    y = NdArray().tag(sync=True, scaled=True,
                rtype='Number', min_dim=2, max_dim=2, atype='bqplot.Axis')
    # FIXME Future warnings
    _y_default = None

    # Other attributes
    scales_metadata = Dict({
        'x': {'orientation': 'horizontal', 'dimension': 'x'},
        'y': {'orientation': 'vertical', 'dimension': 'y'}
    }).tag(sync=True)
    marker = Enum(['candle', 'bar'], default_value='candle', display_name='Marker').tag(sync=True)
    stroke = Color(None, display_name='Stroke color', allow_none=True).tag(sync=True)
    stroke_width = Float(1.0).tag(sync=True, display_name='Stroke Width')
    colors = List(trait=Color(default_value=None, allow_none=True),
                  default_value=['limegreen', 'red']).tag(sync=True, display_name='Colors')
    opacities = List(trait=Float(1.0, min=0, max=1, allow_none=True)).tag(sync=True, display_name='Opacities')
    format = Unicode('ohlc').tag(sync=True, display_name='Format')

    _view_name = Unicode('OHLC').tag(sync=True)
    _model_name = Unicode('OHLCModel').tag(sync=True)


@register_mark('bqplot.Pie')
class Pie(Mark):

    """Piechart mark.

    Attributes
    ----------
    colors: list of colors (default: CATEGORY10)
        list of colors for the slices.
    stroke: color (default: 'white')
        stroke color for the marker
    opacities: list of floats (default: [])
        Opacities for the slices of the Pie mark. Defaults to 1 when the list is
        too short, or the element of the list is set to None.
    sort: bool (default: False)
        sort the pie slices by descending sizes
    x: Float (default: 0.5) or Date
        horizontal position of the pie center, in data coordinates or in figure
        coordinates
    y: Float (default: 0.5)
        vertical y position of the pie center, in data coordinates or in figure
        coordinates
    radius: Float
        radius of the pie, in pixels
    inner_radius: Float
        inner radius of the pie, in pixels
    start_angle: Float (default: 0.0)
        start angle of the pie (from top), in degrees
    end_angle: Float (default: 360.0)
        end angle of the pie (from top), in degrees
    display_labels: bool (default: True)
        display the labels on the pie
    label_color: Color or None (default: None)
        color of the labels
    font_size: string (default: '14px')
        label font size in px, em or ex
    font_weight: {'bold', 'normal', 'bolder'} (default: 'normal')
        label font weight

    Data Attributes

    sizes: numpy.ndarray
        proportions of the pie slices
    color: numpy.ndarray or None
        color of the data points (1d array). Defaults to colors when not
        provided

    Notes
    -----
    The fields which can be passed to the default tooltip are:
        : the x value associated with the bar/candle
        open: open value for the bar/candle
        high: high value for the bar/candle
        low: low value for the bar/candle
        close: close value for the bar/candle
        index: index of the bar/candle being hovered on
    """
    # Mark decoration
    icon = 'fa-pie-chart'
    name = 'Pie chart'

    # Scaled attributes
    sizes = NdArray().tag(sync=True, rtype='Number', min_dim=1, max_dim=1)
    color = NdArray(allow_none=True).tag(sync=True, scaled=True, rtype='Color',
                          atype='bqplot.ColorAxis', min_dim=1, max_dim=1)

    # Other attributes
    x = Float(0.5).tag(sync=True) | Date().tag(sync=True) | Unicode().tag(sync=True)
    y = Float(0.5).tag(sync=True) | Date().tag(sync=True) | Unicode().tag(sync=True)

    scales_metadata = Dict({'color': {'dimension': 'color'}}).tag(sync=True)
    sort = Bool().tag(sync=True)
    colors = List(trait=Color(default_value=None, allow_none=True),
                  default_value=CATEGORY10).tag(sync=True, display_name='Colors')
    stroke = Color(None, allow_none=True).tag(sync=True)
    opacities = List(trait=Float(1.0, min=0, max=1, allow_none=True)).tag(sync=True, display_name='Opacities')
    radius = Float(180.0, min=0.0, max=float('inf')).tag(sync=True)
    inner_radius = Float(0.1, min=0.0, max=float('inf')).tag(sync=True)
    start_angle = Float().tag(sync=True)
    end_angle = Float(360.0).tag(sync=True)
    display_labels = Bool(True).tag(sync=True)
    label_color = Color(None, allow_none=True).tag(sync=True)
    font_size = Unicode(default_value='10px').tag(sync=True)
    font_weight = Enum(['bold', 'normal', 'bolder'],
                       default_value='normal').tag(sync=True)

    _view_name = Unicode('Pie').tag(sync=True)
    _model_name = Unicode('PieModel').tag(sync=True)


import os
import json


def topo_load(name):
    with open(os.path.join(os.path.split(os.path.realpath(__file__))[0],
              name)) as data_file:
        data = json.load(data_file)
    return data


@register_mark('bqplot.Map')
class Map(Mark):

    """Map mark.

    Attributes
    ----------
    colors: Dict (default: {})
        default colors for items of the map when no color data is passed. The dictionary should be indexed by the
        id of the element and have the corresponding colors as values. The key `default_color` controls the items
        for which no color is specified.
    selected_styles: Dict (default: {'selected_fill': 'Red', 'selected_stroke': None, 'selected_stroke_width': 2.0})
        Dictionary containing the styles for selected subunits
    hovered_styles: Dict (default: {'hovered_fill': 'Orange', 'hovered_stroke': None, 'hovered_stroke_width': 2.0})
        Dictionary containing the styles for hovered subunits
    selected: List (default: [])
        list containing the selected countries in the map
    hover_highlight: bool (default: True)
        boolean to control if the map should be aware of which country is being
        hovered on.
    map_data: tuple (default: topoload("WorldMapData.json"))
        tuple containing which map is to be displayed

    Data Attributes

    color: Dict or None (default: None)
        dictionary containing the data associated with every country for the
        color scale
    """

    # Mark decoration
    icon = 'fa-globe'
    name = 'Map'

    # Scaled attributes
    color = Dict(allow_none=True).tag(sync=True, scaled=True, rtype='Color',
                                      atype='bqplot.ColorAxis')

    # Other attributes
    scales_metadata = Dict({'color': {'dimension': 'color'}}).tag(sync=True)
    hover_highlight = Bool(True).tag(sync=True)
    hovered_styles = Dict({
        'hovered_fill': 'Orange',
        'hovered_stroke': None,
        'hovered_stroke_width': 2.0},
    allow_none=True).tag(sync=True)

    stroke_color = Color(default_value=None, allow_none=True).tag(sync=True)
    colors = Dict().tag(sync=True, display_name='Colors')
    scales_metadata = Dict({
        'color': { 'dimension': 'color' },
        'projection': { 'dimension': 'geo' }
    }).tag(sync=True)
    selected = List(allow_none=True).tag(sync=True)
    selected_styles = Dict({
        'selected_fill': 'Red',
        'selected_stroke': None,
        'selected_stroke_width': 2.0
    }).tag(sync=True)

    map_data = Tuple(topo_load('map_data/WorldMapData.json')).tag(sync=True)

    _view_name = Unicode('Map').tag(sync=True)
    _model_name = Unicode('MapModel').tag(sync=True)


@register_mark('bqplot.GridHeatMap')
class GridHeatMap(Mark):

    """GridHeatMap mark.

    Alignment: The tiles can be aligned so that the data matches either the
    start, the end or the midpoints of the tiles. This is controlled by the
    align attribute.

    Suppose the data passed is a m-by-n matrix. If the scale for the rows is
    Ordinal, then alignment is by default the mid points. For a non-ordinal
    scale, the data cannot be aligned to the mid points of the rectangles.

    If it is not ordinal, then two cases arise. If the number of rows passed
    is m, then align attribute can be used. If the number of rows passed is m+1,
    then the data are the boundaries of the m rectangles.

    If rows and columns are not passed, and scales for them are also not passed,
    then ordinal scales are generated for the rows and columns.

    Attributes
    ----------
    row_align: Enum(['start', 'end'])
        This is only valid if the number of entries in `row` exactly match the
        number of rows in `color` and the `row_scale` is not `OrdinalScale`.
        `start` aligns the row values passed to be aligned with the start of the
        tiles and `end` aligns the row values to the end of the tiles.
    column_align: Enum(['start', end'])
        This is only valid if the number of entries in `column` exactly match the
        number of columns in `color` and the `column_scale` is not `OrdinalScale`.
        `start` aligns the column values passed to be aligned with the start of the
        tiles and `end` aligns the column values to the end of the tiles.
    anchor_style: dict (default: {'fill': 'white', 'stroke': 'blue'})
        Controls the style for the element which serves as the anchor duringi
        selection.

    Data Attributes

    color: numpy.ndarray
        color of the data points (2d array). The number of elements in this array
        correspond to the number of cells created in the heatmap.
    row: numpy.ndarray or None
        labels for the rows of the `color` array passed. The length of this can be
        no more than 1 away from the number of rows in `color`.
        This is a scaled attribute and can be used to affect the height of the
        cells as the entries of `row` can indicate the start or the end points
        of the cells. Refer to the property `row_align`.
        If this prorety is None, then a uniformly spaced grid is generated in
        the row direction.
    column: numpy.ndarray or None
        labels for the columns of the `color` array passed. The length of this can be
        no more than 1 away from the number of columns in `color`
        This is a scaled attribute and can be used to affect the width of the
        cells as the entries of `column` can indicate the start or the end points
        of the cells. Refer to the property `column_align`.
        If this prorety is None, then a uniformly spaced grid is generated in
        the column direction.
    """
    # Scaled attributes
    row = NdArray(allow_none=True).tag(sync=True, scaled=True,
                  rtype='Number', min_dim=1, max_dim=1, atype='bqplot.Axis')
    column = NdArray(allow_none=True).tag(sync=True, scaled=True,
                     rtype='Number', min_dim=1, max_dim=1, atype='bqplot.Axis')
    color = NdArray(None, allow_none=True).tag(sync=True, scaled=True, rtype='Color',
                    atype='bqplot.ColorAxis', min_dim=1, max_dim=2)

    # Other attributes
    scales_metadata = Dict({
        'row': {'orientation': 'vertical', 'dimension': 'y'},
        'column': {'orientation': 'horizontal', 'dimension': 'x'},
        'color': {'dimension': 'color'}
    }).tag(sync=True)

    row_align = Enum(['start', 'end'], default_value='start').tag(sync=True)
    column_align = Enum(['start', 'end'], default_value='start').tag(sync=True)
    null_color = Color('black', allow_none=True).tag(sync=True)
    stroke = Color('black', allow_none=True).tag(sync=True)
    opacity = Float(1.0, min=0.2, max=1).tag(sync=True, display_name='Opacity')
    anchor_style = Dict({'fill': 'white', 'stroke': 'blue'}).tag(sync=True)

    def __init__(self, **kwargs):
        data = kwargs['color']
        row = kwargs.pop('row', range(data.shape[0]))
        column = kwargs.pop('column', range(data.shape[1]))
        scales = kwargs.pop('scales', {})
        # Adding default row and column data if they are not passed.
        # Adding scales in case they are not passed too.

        kwargs['row'] = row
        if(scales.get('row', None) is None):
            row_scale = OrdinalScale(reverse=True)
            scales['row'] = row_scale

        kwargs['column'] = column
        if(scales.get('column', None) is None):
            column_scale = OrdinalScale()
            scales['column'] = column_scale
        kwargs['scales'] = scales
        super(GridHeatMap, self).__init__(**kwargs)

    _view_name = Unicode('GridHeatMap').tag(sync=True)
    _model_name = Unicode('GridHeatMapModel').tag(sync=True)
