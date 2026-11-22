import { render } from 'solid-js/web';
import App from './App';
import './styles.css';
import './designs/themes.css';
import './designs/designs.css';
import './analytics/analytics.css';
import './desktop/desktop.css';
import { watchSvgUnits } from './svgUnit';

const root = document.getElementById('root')!;
watchSvgUnits(root);
render(() => <App />, root);
