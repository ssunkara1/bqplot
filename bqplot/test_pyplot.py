def plot(*args, **kwargs):
    """Draw lines in the current context figure.

    Signature: `plot(x, y, **kwargs)` or `plot(y, **kwargs)`, depending of the
    length of the list of positional arguments. In the case where the `x` array
    is not provided.

    Parameters
    ----------
    x: numpy.ndarray or list, 1d or 2d (optional)
        The x-coordinates of the plotted line. When not provided, the function
        defaults to `numpy.arange(len(y))`
        x can be 1-dimensional or 2-dimensional.
    y: numpy.ndarray or list, 1d or 2d
        The y-coordinates of the plotted line. If argument `x` is 2-dimensional
        it must also be 2-dimensional.
    marker_str: string
        string representing line_style, marker and color.
        For e.g. 'g--o', 'sr' etc
    options: dict (default: {})
        Options for the scales to be created. If a scale labeled 'x' is
        required for that mark, options['x'] contains optional keyword
        arguments for the constructor of the corresponding scale type.
    axes_options: dict (default: {})
        Options for the axes to be created. If an axis labeled 'x' is required
        for that mark, axes_options['x'] contains optional keyword arguments
        for the constructor of the corresponding axis type.
    figure: Figure or None
        The figure to which the line is to be added.
        If the value is None, the current figure is used.
    """
    marker_str = None
    if len(args) == 1:
        kwargs['y'] = args[0]
        print('Kwargs is:', kwargs)
        if kwargs.get('index_data', None) is not None:
            kwargs['x'] = kwargs['index_data']
        else:
            kwargs['x'] = _infer_x_for_line(args[0]);
    elif len(args) == 2:
        if type(args[1]) == str:
            kwargs['y'] = args[0]
            kwargs['x'] = _infer_x_for_line(args[0])
            marker_str = args[1].strip()
        else:
            kwargs['x'] = args[0]
            kwargs['y'] = args[1]
    elif len(args) == 3:
        kwargs['x'] = args[0]
        kwargs['y'] = args[1]
        if type(args[2]) == str:
            marker_str = args[2].strip()

    if marker_str:
        line_style, color, marker = _get_line_styles(marker_str)

        # only marker specified => draw scatter
        if marker and not line_style:
            kwargs['marker'] = marker
            if color:
                kwargs['default_colors'] = [color]
            return _draw_mark(Scatter, **kwargs)
        else:  # draw lines in all other cases
            kwargs['line_style'] = line_style or 'solid'

            if marker:
                kwargs['marker'] = marker
            if color:
                kwargs['colors'] = [color]
            return _draw_mark(Lines, **kwargs)
    else:
        return _draw_mark(Lines, **kwargs)
