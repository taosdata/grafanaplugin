import { QueryCtrl } from 'app/plugins/sdk';
import './css/query-editor.css!'

export class GenericDatasourceQueryCtrl extends QueryCtrl {
  constructor($scope, $injector) {
    super($scope, $injector);

    this.scope = $scope;
    this.target.target = this.target.target || 'select metric';
    this.target.type = this.target.type || 'timeserie';
    this.target.queryType = this.target.queryType || 'SQL';
    this.target.formatType = this.target.formatType || 'Time series';

    this.queryTypes = ["SQL", "Arithmetic"];
    this.formatTypes = ["Time series", "Table"];
  }

  onChangeInternal() {
    this.panelCtrl.refresh(); // Asks the panel to refresh data.
  }

  targetBlur() {
    this.panelCtrl.refresh();
  }

  generateSQL() {
    this.lastGenerateSQL = this.datasource.generateSql(this.target.sql);
    this.showGenerateSQL = !this.showGenerateSQL;
  }

  validateArithmeticQuery(target, errs) {
    if (!target.expression || target.expression.length == 0) {
      errs.expression = "Must specify a javascript expression";
      return false;
    }
    return true;
  }

}

GenericDatasourceQueryCtrl.templateUrl = 'partials/query.editor.html';