/* src/components/testing/icar16/items/itemAssets.js */

/**
 * Static imports of canonical figure assets keyed by item ID.
 * Lets webpack bundle each figure once, fingerprinted, and lets
 * renderers look up the right URL by the item's `id` field.
 */

import MX45 from '../../../../assets/icar/matrix/MX45.jpg';
import MX46 from '../../../../assets/icar/matrix/MX46.jpg';
import MX47 from '../../../../assets/icar/matrix/MX47.jpg';
import MX55 from '../../../../assets/icar/matrix/MX55.jpg';
import R3D03 from '../../../../assets/icar/rotation/R3D03.jpg';
import R3D04 from '../../../../assets/icar/rotation/R3D04.jpg';
import R3D06 from '../../../../assets/icar/rotation/R3D06.jpg';
import R3D08 from '../../../../assets/icar/rotation/R3D08.jpg';

export const ITEM_FIGURES = {
    'MX.45': MX45,
    'MX.46': MX46,
    'MX.47': MX47,
    'MX.55': MX55,
    'R3D.3': R3D03,
    'R3D.4': R3D04,
    'R3D.6': R3D06,
    'R3D.8': R3D08,
};
